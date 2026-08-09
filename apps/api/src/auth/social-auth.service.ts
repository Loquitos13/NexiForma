import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash, randomBytes } from "crypto";
import { SignJWT, createRemoteJWKSet, jwtVerify } from "jose";
import type { Response } from "express";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import type { RequestUser } from "./types/access-token-payload";
import { requireTenantId } from "../common/tenant-scope";
import { AuthService } from "./auth.service";
import { EmailConfirmationService } from "./email-confirmation.service";
import {
  buildTenantAmbiguousPayload,
  buildTenantAuthPick,
  isTenantOperational,
  normalizeAuthEmail,
  type TenantAuthPick,
} from "./tenant-auth-resolve.util";
import { readTenantLogoStorageKey, tenantDisplayInitials } from "./tenant-branding.util";
import {
  OAUTH_EXCHANGE_JWT_PURPOSE,
  OAUTH_TENANT_PICK_JWT_PURPOSE,
  SOCIAL_PROVIDER_ISSUERS,
  SOCIAL_PROVIDER_LABELS,
  SOCIAL_PROVIDER_SCOPES,
  extractOAuthEmail,
  isSocialProviderEnabled,
  readTenantSocialLogin,
  resolveOAuthReturnOrigin,
  type SocialProvider,
  type TenantMetadataWithSocialLogin,
} from "./social-auth.util";

type OidcDiscovery = {
  authorization_endpoint: string;
  token_endpoint: string;
  issuer: string;
  jwks_uri: string;
};

type OAuthStatePayload = {
  tenantSlug: string;
  codeVerifier: string;
  nonce: string;
  provider: SocialProvider;
  returnOrigin: string;
};

type OAuthExchangePayload = {
  purpose: string;
  tenantSlug: string;
  refreshOpaque: string;
};

type OAuthTenantPickOption = {
  slug: string;
  userId: string;
  legalName: string;
  roleLabel: string;
  logoUrl?: string;
  initials: string;
};

type OAuthTenantPickPayload = {
  purpose: string;
  email: string;
  sub: string;
  provider: SocialProvider;
  returnOrigin: string;
  options: OAuthTenantPickOption[];
};

@Injectable()
export class SocialAuthService {
  private readonly logger = new Logger(SocialAuthService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly auth: AuthService,
    private readonly emailConfirmation: EmailConfirmationService,
    private readonly storage: StorageService,
  ) {}

  private apiPublicUrl(): string {
    const raw =
      this.config.get<string>("API_PUBLIC_URL") ??
      `http://localhost:${this.config.get<string>("API_PORT") ?? "4000"}`;
    return raw.replace(/\/$/, "");
  }

  private webOrigin(): string {
    return (this.config.get<string>("APP_PUBLIC_URL") ?? "http://localhost:3000").replace(/\/$/, "");
  }

  private providerCredentials(provider: SocialProvider): { clientId: string; clientSecret: string } | null {
    const envKey = provider === "google" ? "AUTH_GOOGLE" : "AUTH_MICROSOFT";
    const clientId = this.config.get<string>(`${envKey}_CLIENT_ID`)?.trim();
    const clientSecret = this.config.get<string>(`${envKey}_CLIENT_SECRET`)?.trim();
    if (!clientId || !clientSecret) return null;
    return { clientId, clientSecret };
  }

  isProviderConfigured(provider: SocialProvider): boolean {
    return this.providerCredentials(provider) !== null;
  }

  private async findTenantBySlug(slug: string) {
    const trimmed = slug.trim();
    if (!trimmed) return null;
    return this.prisma.tenant.findFirst({
      where: { slug: { equals: trimmed, mode: "insensitive" } },
      select: { id: true, slug: true, status: true, metadata: true, legalName: true },
    });
  }

  async getPublicProviders(tenantSlug?: string) {
    const slug = tenantSlug?.trim() ?? "";
    const apiPublic = this.apiPublicUrl();
    const googleConfigured = this.isProviderConfigured("google");
    const microsoftConfigured = this.isProviderConfigured("microsoft");

    const platformFallback = () => ({
      google: googleConfigured,
      microsoft: microsoftConfigured,
      googleStartUrl: googleConfigured ? `${apiPublic}/v1/auth/oauth/google/start` : null,
      microsoftStartUrl: microsoftConfigured
        ? `${apiPublic}/v1/auth/oauth/microsoft/start`
        : null,
    });

    if (!slug) {
      return platformFallback();
    }

    const tenant = await this.findTenantBySlug(slug);
    if (!tenant || !isTenantOperational(tenant.status)) {
      return platformFallback();
    }

    const canonicalSlug = tenant.slug;
    return {
      google: isSocialProviderEnabled("google", tenant.metadata, googleConfigured),
      microsoft: isSocialProviderEnabled("microsoft", tenant.metadata, microsoftConfigured),
      googleStartUrl: isSocialProviderEnabled("google", tenant.metadata, googleConfigured)
        ? `${apiPublic}/v1/auth/oauth/google/start?slug=${encodeURIComponent(canonicalSlug)}`
        : null,
      microsoftStartUrl: isSocialProviderEnabled("microsoft", tenant.metadata, microsoftConfigured)
        ? `${apiPublic}/v1/auth/oauth/microsoft/start?slug=${encodeURIComponent(canonicalSlug)}`
        : null,
    };
  }

  async getManagerConfig(user: RequestUser) {
    return this.getSocialLoginConfigForTenant(requireTenantId(user));
  }

  async getSocialLoginConfigForTenant(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { slug: true, metadata: true },
    });
    if (!tenant) throw new NotFoundException("Tenant não encontrado.");

    const cfg = readTenantSocialLogin(tenant.metadata);
    return {
      slug: tenant.slug,
      google: {
        platformConfigured: this.isProviderConfigured("google"),
        enabled: isSocialProviderEnabled("google", tenant.metadata, this.isProviderConfigured("google")),
        tenantEnabled: cfg.google !== false,
      },
      microsoft: {
        platformConfigured: this.isProviderConfigured("microsoft"),
        enabled: isSocialProviderEnabled(
          "microsoft",
          tenant.metadata,
          this.isProviderConfigured("microsoft"),
        ),
        tenantEnabled: cfg.microsoft !== false,
      },
      redirectUri: `${this.apiPublicUrl()}/v1/auth/oauth/callback`,
    };
  }

  async updateManagerConfig(
    user: RequestUser,
    payload: { google?: boolean; microsoft?: boolean },
  ) {
    return this.updateSocialLoginConfigForTenant(requireTenantId(user), payload);
  }

  async updateSocialLoginConfigForTenant(
    tenantId: string,
    payload: { google?: boolean; microsoft?: boolean },
  ) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { metadata: true },
    });
    if (!tenant) throw new NotFoundException("Tenant não encontrado.");

    const meta = (tenant.metadata ?? {}) as TenantMetadataWithSocialLogin;
    const prev = meta.socialLogin ?? {};
    const next: TenantMetadataWithSocialLogin = {
      ...meta,
      socialLogin: {
        ...prev,
        ...(payload.google !== undefined ? { google: payload.google } : {}),
        ...(payload.microsoft !== undefined ? { microsoft: payload.microsoft } : {}),
      },
    };

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { metadata: next as object },
    });

    return this.getSocialLoginConfigForTenant(tenantId);
  }

  async startLogin(
    provider: SocialProvider,
    tenantSlug: string,
    res: Response,
    returnTo?: string,
  ) {
    const creds = this.providerCredentials(provider);
    if (!creds) {
      throw new BadRequestException(`Login ${SOCIAL_PROVIDER_LABELS[provider]} não configurado na plataforma.`);
    }

    const slug = tenantSlug?.trim() ?? "";
    let canonicalSlug = slug;
    if (slug) {
      const tenant = await this.findTenantBySlug(slug);
      if (tenant && isTenantOperational(tenant.status)) {
        canonicalSlug = tenant.slug;
        if (!isSocialProviderEnabled(provider, tenant.metadata, true)) {
          throw new BadRequestException(
            `Login ${SOCIAL_PROVIDER_LABELS[provider]} desactivado para esta entidade.`,
          );
        }
      } else {
        this.logger.warn(
          `OAuth start: slug "${slug}" inválido ou indisponível - resolução adiada para o callback.`,
        );
        canonicalSlug = slug;
      }
    }

    const issuer = SOCIAL_PROVIDER_ISSUERS[provider];
    const discovery = await this.fetchDiscovery(issuer);
    const codeVerifier = randomBytes(32).toString("base64url");
    const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
    const nonce = randomBytes(16).toString("hex");
    const returnOrigin = resolveOAuthReturnOrigin(returnTo, this.webOrigin());
    const state = await this.signState({
      tenantSlug: canonicalSlug,
      codeVerifier,
      nonce,
      provider,
      returnOrigin,
    });

    const redirectUri = `${this.apiPublicUrl()}/v1/auth/oauth/callback`;
    const scopes = SOCIAL_PROVIDER_SCOPES[provider].join(" ");
    const url = new URL(discovery.authorization_endpoint);
    url.searchParams.set("client_id", creds.clientId);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", scopes);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("nonce", nonce);
    url.searchParams.set("code_challenge", codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
    if (provider === "google") {
      url.searchParams.set("prompt", "select_account");
    }

    res.redirect(url.toString());
  }

  async handleCallback(code: string | undefined, state: string | undefined, res: Response, oauthError?: string) {
    if (oauthError) {
      this.redirectLoginError(`Autenticação cancelada (${oauthError}).`, res);
      return;
    }
    if (!code || !state) {
      this.redirectLoginError("Parâmetros OAuth em falta.", res);
      return;
    }

    let payload: OAuthStatePayload;
    try {
      payload = await this.verifyState(state);
    } catch (err) {
      this.logger.warn(
        `OAuth state inválido: ${err instanceof Error ? err.message : String(err)}`,
      );
      this.redirectLoginError(
        "Sessão OAuth inválida ou expirada. Volte ao login e tente novamente.",
        res,
      );
      return;
    }

    const hintSlug = payload.tenantSlug?.trim() ?? "";
    const returnOrigin = payload.returnOrigin || this.webOrigin();

    const creds = this.providerCredentials(payload.provider);
    if (!creds) {
      this.redirectLoginError("Login social não configurado.", res, hintSlug, returnOrigin);
      return;
    }

    try {
      const issuer = SOCIAL_PROVIDER_ISSUERS[payload.provider];
      const discovery = await this.fetchDiscovery(issuer);
      const redirectUri = `${this.apiPublicUrl()}/v1/auth/oauth/callback`;
      const scopes = SOCIAL_PROVIDER_SCOPES[payload.provider].join(" ");

      const tokenParams: Record<string, string> = {
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        code_verifier: payload.codeVerifier,
        scope: scopes,
      };

      const tokenRes = await fetch(discovery.token_endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(tokenParams),
      });

      if (!tokenRes.ok) {
        const errText = await tokenRes.text().catch(() => "");
        this.logger.warn(
          `OAuth token exchange failed (${payload.provider}): ${tokenRes.status} ${errText.slice(0, 400)}`,
        );
        const hint = this.tokenExchangeErrorHint(payload.provider, errText);
        this.redirectLoginError(
          hint ?? "Falha na troca do código OAuth.",
          res,
          hintSlug,
          returnOrigin,
        );
        return;
      }

      const tokens = (await tokenRes.json()) as { id_token?: string };
      if (!tokens.id_token) {
        this.redirectLoginError("ID token em falta na resposta OAuth.", res, hintSlug, returnOrigin);
        return;
      }

      const jwks = createRemoteJWKSet(new URL(discovery.jwks_uri));
      const verifyOpts =
        payload.provider === "google"
          ? { issuer: discovery.issuer, audience: creds.clientId }
          : { audience: creds.clientId };
      const { payload: claims } = await jwtVerify(tokens.id_token, jwks, verifyOpts);

      if (payload.provider === "microsoft") {
        const tokenNonce = String(claims.nonce ?? "");
        if (!tokenNonce || tokenNonce !== payload.nonce) {
          this.redirectLoginError("Nonce OAuth inválido (Microsoft).", res, hintSlug, returnOrigin);
          return;
        }
      }

      const email = extractOAuthEmail(claims as Record<string, unknown>);
      const sub = String(claims.sub ?? "");
      if (!email || !sub) {
        this.redirectLoginError("Conta OAuth sem email válido.", res, hintSlug, returnOrigin);
        return;
      }

      const resolved = await this.resolveOAuthUser(email, sub, hintSlug);
      if (!resolved) {
        this.redirectLoginError(
          `Utilizador não encontrado (${email}). Peça ao gestor para criar a conta com o mesmo email.`,
          res,
          hintSlug,
          returnOrigin,
        );
        return;
      }
      if ("ambiguous" in resolved) {
        const tenantOptions = resolved.tenants ?? [];
        if (tenantOptions.length < 2) {
          this.redirectLoginError("Seleção de entidade incompleta.", res, hintSlug, returnOrigin);
          return;
        }
        const pick = await this.signOAuthPick({
          purpose: OAUTH_TENANT_PICK_JWT_PURPOSE,
          email,
          sub,
          provider: payload.provider,
          returnOrigin,
          options: tenantOptions.map((t) => ({
            slug: t.slug,
            userId: t.userId,
            legalName: t.legalName,
            roleLabel: t.roleLabel,
            logoUrl: t.logoUrl,
            initials: t.initials,
          })),
        });
        const url = `${returnOrigin.replace(/\/$/, "")}/login?sso=pick&pick=${encodeURIComponent(pick)}`;
        res.redirect(url);
        return;
      }

      const { user, tenant } = resolved;
      if (!isTenantOperational(tenant.status)) {
        this.redirectLoginError("Entidade indisponível.", res, tenant.slug, returnOrigin);
        return;
      }
      if (!isSocialProviderEnabled(payload.provider, tenant.metadata, true)) {
        this.redirectLoginError("Login social desactivado para esta entidade.", res, tenant.slug, returnOrigin);
        return;
      }

      const activeUser = await this.ensureOAuthSubjectLinked(user, sub, email);
      // Provedor OAuth já validou o email.
      await this.emailConfirmation.markVerified(activeUser.id).catch(() => undefined);

      const login = await this.auth.completeLoginForUser(activeUser, undefined, false, {
        includeRefreshOpaque: true,
      });
      if (!login.refreshToken) {
        this.redirectLoginError("Não foi possível criar sessão OAuth.", res, tenant.slug, returnOrigin);
        return;
      }

      const exchange = await this.signExchange({
        purpose: OAUTH_EXCHANGE_JWT_PURPOSE,
        tenantSlug: tenant.slug,
        refreshOpaque: login.refreshToken,
      });
      const redirectBase = `${returnOrigin}/login?sso=exchange&slug=${encodeURIComponent(tenant.slug)}&x=${encodeURIComponent(exchange)}`;
      res.redirect(redirectBase);
    } catch (err) {
      this.logger.warn(
        `OAuth callback error (${payload.provider}): ${err instanceof Error ? err.message : String(err)}`,
      );
      this.redirectLoginError("Não foi possível concluir o login social.", res, hintSlug, returnOrigin);
    }
  }

  async exchangeSession(exchangeToken: string, res: Response) {
    const payload = await this.verifyExchange(exchangeToken);
    return this.auth.completeOAuthExchange(payload.refreshOpaque, payload.tenantSlug, res);
  }

  async getOAuthPickOptions(pickToken: string) {
    const payload = await this.verifyOAuthPick(pickToken);
    return {
      email: payload.email,
      provider: payload.provider,
      message:
        "Este email existe em várias entidades. Escolha em qual pretende entrar.",
      tenants: payload.options.map((o) => ({
        slug: o.slug,
        legalName: o.legalName,
        roleLabel: o.roleLabel,
        logoUrl: o.logoUrl,
        initials: o.initials,
      })),
    };
  }

  async streamPublicTenantLogo(slugRaw: string, res: Response) {
    const slug = slugRaw.trim();
    if (!slug) {
      res.status(400).send("Slug em falta.");
      return;
    }
    const tenant = await this.findTenantBySlug(slug);
    if (!tenant || !isTenantOperational(tenant.status)) {
      res.status(404).send("Entidade não encontrada.");
      return;
    }
    const key = readTenantLogoStorageKey(tenant.metadata);
    if (!key) {
      res.status(404).send("Logo não configurado.");
      return;
    }
    const obj = await this.storage.getObject(key);
    if (!obj) {
      res.status(404).send("Logo não encontrado.");
      return;
    }
    res.setHeader("Content-Type", obj.contentType);
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(obj.body);
  }

  async completeOAuthPick(pickToken: string, tenantSlug: string, res: Response) {
    const payload = await this.verifyOAuthPick(pickToken);
    const slug = tenantSlug.trim();
    const option = payload.options.find((o) => o.slug === slug);
    if (!option) {
      throw new BadRequestException("Entidade seleccionada inválida.");
    }

    const user = await this.prisma.user.findFirst({
      where: {
        id: option.userId,
        email: payload.email,
        active: true,
        tenant: { slug: option.slug, status: { notIn: ["SUSPENDED", "ARCHIVED"] } },
      },
      include: { tenant: true },
    });
    if (!user) {
      throw new UnauthorizedException("Utilizador indisponível nesta entidade.");
    }
    if (!isSocialProviderEnabled(payload.provider, user.tenant.metadata, true)) {
      throw new BadRequestException("Login social desactivado para esta entidade.");
    }

    const activeUser = await this.ensureOAuthSubjectLinked(user, payload.sub, payload.email);
    await this.emailConfirmation.markVerified(activeUser.id).catch(() => undefined);
    return this.auth.completeLoginForUser(activeUser, res);
  }

  /**
   * Liga o subject OAuth ao user quando possível.
   * `cognito_sub` é único global: no mesmo email em vários tenants só a primeira
   * conta guarda o subject - as restantes fazem login sem o gravar de novo.
   */
  private async ensureOAuthSubjectLinked<
    T extends { id: string; email: string; cognitoSub: string | null },
  >(user: T, oauthSubRaw: string, expectedEmail: string): Promise<T> {
    const oauthSub = oauthSubRaw.trim();
    if (!oauthSub) {
      throw new UnauthorizedException("Identidade OAuth inválida.");
    }

    if (user.cognitoSub) {
      if (user.cognitoSub !== oauthSub) {
        throw new UnauthorizedException("Conta OAuth já associada a outro utilizador.");
      }
      return user;
    }

    const existing = await this.prisma.user.findFirst({
      where: { cognitoSub: oauthSub },
      select: { id: true, email: true },
    });
    if (existing) {
      if (existing.id === user.id) return user;
      if (normalizeAuthEmail(existing.email) !== normalizeAuthEmail(expectedEmail)) {
        throw new UnauthorizedException("Conta OAuth já associada a outro utilizador.");
      }
      this.logger.debug(
        `OAuth sub já ligado a user ${existing.id}; login em ${user.id} sem actualizar cognitoSub.`,
      );
      return user;
    }

    try {
      return (await this.prisma.user.update({
        where: { id: user.id },
        data: { cognitoSub: oauthSub },
        include: { tenant: true },
      })) as unknown as T;
    } catch (err) {
      const code =
        err && typeof err === "object" && "code" in err ? String((err as { code?: unknown }).code) : "";
      if (code === "P2002") {
        // Corrida: outro pedido gravou o mesmo sub entretanto.
        const raced = await this.prisma.user.findFirst({
          where: { cognitoSub: oauthSub },
          select: { id: true, email: true },
        });
        if (raced && normalizeAuthEmail(raced.email) === normalizeAuthEmail(expectedEmail)) {
          return user;
        }
        throw new UnauthorizedException("Conta OAuth já associada a outro utilizador.");
      }
      throw err;
    }
  }

  private async resolveOAuthUser(emailRaw: string, sub: string, hintSlug: string) {
    const email = normalizeAuthEmail(emailRaw);
    const hinted = hintSlug.trim();

    const candidates = await this.prisma.user.findMany({
      where: {
        email,
        active: true,
        tenant: { status: { notIn: ["SUSPENDED", "ARCHIVED"] } },
      },
      include: { tenant: true },
    });

    if (candidates.length > 1) {
      const tenants: Array<TenantAuthPick & { userId: string }> = candidates.map((row) => ({
        ...buildTenantAuthPick({
          slug: row.tenant.slug,
          legalName: row.tenant.legalName,
          role: row.role,
          metadata: row.tenant.metadata,
        }),
        userId: row.id,
      }));
      return {
        ambiguous: true as const,
        message: buildTenantAmbiguousPayload(tenants).message,
        tenants,
      };
    }

    if (hinted) {
      const tenant = await this.findTenantBySlug(hinted);
      if (tenant && isTenantOperational(tenant.status)) {
        const user = candidates.find((row) => row.tenantId === tenant.id);
        if (user) return { user, tenant: user.tenant };
      }
    }

    if (candidates.length === 1) {
      return { user: candidates[0], tenant: candidates[0].tenant };
    }

    const bySub = await this.prisma.user.findFirst({
      where: { cognitoSub: sub, active: true, tenant: { status: { notIn: ["SUSPENDED", "ARCHIVED"] } } },
      include: { tenant: true },
    });
    if (bySub) return { user: bySub, tenant: bySub.tenant };

    return null;
  }

  private redirectLoginError(message: string, res: Response, slug?: string, returnOrigin?: string) {
    const qs = new URLSearchParams({ sso: "error", message });
    if (slug?.trim()) qs.set("slug", slug.trim());
    const origin = (returnOrigin ?? this.webOrigin()).replace(/\/$/, "");
    const url = `${origin}/login?${qs.toString()}`;
    res.redirect(url);
  }

  private tokenExchangeErrorHint(provider: SocialProvider, errText: string): string | null {
    const lower = errText.toLowerCase();
    if (lower.includes("invalid_client") || lower.includes("7000215")) {
      return `Credenciais ${SOCIAL_PROVIDER_LABELS[provider]} inválidas (client secret incorrecto no .env ou Azure).`;
    }
    if (lower.includes("invalid_grant") || lower.includes("700082")) {
      return "Código OAuth expirado ou redirect URI não coincide com o registado no provider.";
    }
    if (lower.includes("redirect_uri")) {
      return "Redirect URI OAuth não autorizado. Use http://localhost:3001/v1/auth/oauth/callback no Google/Azure.";
    }
    return null;
  }

  private async signOAuthPick(payload: OAuthTenantPickPayload): Promise<string> {
    const secret = new TextEncoder().encode(this.config.getOrThrow<string>("JWT_SECRET"));
    return new SignJWT(payload as unknown as Record<string, unknown>)
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("10m")
      .setIssuedAt()
      .sign(secret);
  }

  private async verifyOAuthPick(token: string): Promise<OAuthTenantPickPayload> {
    try {
      const secret = new TextEncoder().encode(this.config.getOrThrow<string>("JWT_SECRET"));
      const { payload } = await jwtVerify(token, secret, { clockTolerance: 60 });
      return this.parseOAuthPickPayload(payload as Record<string, unknown>);
    } catch (err) {
      if (err instanceof UnauthorizedException || err instanceof BadRequestException) {
        throw err;
      }
      this.logger.warn(
        `OAuth pick token inválido: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new UnauthorizedException("Seleção OAuth expirada ou inválida. Volte a iniciar o login social.");
    }
  }

  private parseOAuthPickPayload(payload: Record<string, unknown>): OAuthTenantPickPayload {
    if (payload.purpose !== OAUTH_TENANT_PICK_JWT_PURPOSE) {
      throw new UnauthorizedException("Seleção OAuth inválida.");
    }
    const email = normalizeAuthEmail(String(payload.email ?? ""));
    const sub = String(payload.sub ?? "");
    const provider = payload.provider === "microsoft" ? "microsoft" : "google";
    const returnOrigin = resolveOAuthReturnOrigin(
      String(payload.returnOrigin ?? ""),
      this.webOrigin(),
    );
    const rawOptions = Array.isArray(payload.options) ? payload.options : [];
    const options: OAuthTenantPickOption[] = rawOptions
      .map((raw) => {
        const row = (raw ?? {}) as Record<string, unknown>;
        const slug = String(row.slug ?? "").trim();
        const userId = String(row.userId ?? "").trim();
        const legalName = String(row.legalName ?? slug).trim();
        const roleLabel = String(row.roleLabel ?? "").trim();
        const logoUrlRaw = String(row.logoUrl ?? "").trim();
        const initialsRaw = String(row.initials ?? "").trim();
        const legalNameForInitials = legalName || slug;
        if (!slug || !userId) return null;
        return {
          slug,
          userId,
          legalName: legalNameForInitials,
          roleLabel: roleLabel || "Utilizador",
          ...(logoUrlRaw ? { logoUrl: logoUrlRaw } : {}),
          initials: initialsRaw || tenantDisplayInitials(legalNameForInitials),
        };
      })
      .filter((row): row is OAuthTenantPickOption => row !== null);

    if (!email || !sub || options.length < 2) {
      throw new UnauthorizedException("Seleção OAuth incompleta.");
    }
    return {
      purpose: OAUTH_TENANT_PICK_JWT_PURPOSE,
      email,
      sub,
      provider,
      returnOrigin,
      options,
    };
  }

  private async signExchange(payload: OAuthExchangePayload): Promise<string> {
    const secret = new TextEncoder().encode(this.config.getOrThrow<string>("JWT_SECRET"));
    return new SignJWT(payload as unknown as Record<string, unknown>)
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("3m")
      .setIssuedAt()
      .sign(secret);
  }

  private async verifyExchange(token: string): Promise<OAuthExchangePayload> {
    const secret = new TextEncoder().encode(this.config.getOrThrow<string>("JWT_SECRET"));
    const { payload } = await jwtVerify(token, secret, { clockTolerance: 60 });
    if (payload.purpose !== OAUTH_EXCHANGE_JWT_PURPOSE) {
      throw new UnauthorizedException("Exchange OAuth inválido.");
    }
    const tenantSlug = String(payload.tenantSlug ?? "");
    const refreshOpaque = String(payload.refreshOpaque ?? "");
    if (!tenantSlug || !refreshOpaque) {
      throw new UnauthorizedException("Exchange OAuth incompleto.");
    }
    return { purpose: OAUTH_EXCHANGE_JWT_PURPOSE, tenantSlug, refreshOpaque };
  }

  private async fetchDiscovery(issuer: string): Promise<OidcDiscovery> {
    const base = issuer.replace(/\/$/, "");
    const res = await fetch(`${base}/.well-known/openid-configuration`);
    if (!res.ok) {
      throw new BadRequestException("Não foi possível obter metadata OpenID do provider.");
    }
    return res.json() as Promise<OidcDiscovery>;
  }

  private async signState(payload: OAuthStatePayload): Promise<string> {
    const secret = new TextEncoder().encode(this.config.getOrThrow<string>("JWT_SECRET"));
    return new SignJWT(payload as unknown as Record<string, unknown>)
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("15m")
      .setIssuedAt()
      .sign(secret);
  }

  private async verifyState(token: string): Promise<OAuthStatePayload> {
    const secret = new TextEncoder().encode(this.config.getOrThrow<string>("JWT_SECRET"));
    const { payload } = await jwtVerify(token, secret, { clockTolerance: 60 });
    const tenantSlug = String(payload.tenantSlug ?? "").trim();
    const codeVerifier = String(payload.codeVerifier ?? "");
    const nonce = String(payload.nonce ?? "");
    const provider = payload.provider === "microsoft" ? "microsoft" : "google";
    const returnOrigin = resolveOAuthReturnOrigin(
      String(payload.returnOrigin ?? ""),
      this.webOrigin(),
    );
    if (!codeVerifier || !nonce) {
      throw new UnauthorizedException("State OAuth incompleto.");
    }
    return { tenantSlug, codeVerifier, nonce, provider, returnOrigin };
  }
}
