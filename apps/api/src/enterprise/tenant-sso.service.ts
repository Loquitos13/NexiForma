import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash, randomBytes } from "crypto";
import { SignJWT, jwtVerify } from "jose";
import type { Response } from "express";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/types/access-token-payload";
import { requireTenantId } from "../common/tenant-scope";
import { AuthService } from "../auth/auth.service";
import {
  desencriptarPasswordWfa,
  encriptarPasswordWfa,
} from "../faturas/at-faturas-credentials.util";
import {
  readTenantSso,
  sanitizeSsoForClient,
  type TenantMetadataWithSso,
  type TenantSsoConfig,
} from "./tenant-sso.util";

type OidcDiscovery = {
  authorization_endpoint: string;
  token_endpoint: string;
  issuer: string;
};

type SsoStatePayload = {
  tenantSlug: string;
  codeVerifier: string;
  nonce: string;
};

@Injectable()
export class TenantSsoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly auth: AuthService,
  ) {}

  private encryptionKey(): string {
    return (
      this.config.get<string>("AT_CREDENTIALS_ENCRYPTION_KEY") ??
      this.config.getOrThrow<string>("JWT_SECRET")
    );
  }

  async getConfigForManager(user: RequestUser) {
    const tenantId = requireTenantId(user);
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { slug: true, metadata: true },
    });
    if (!tenant) throw new NotFoundException("Tenant não encontrado.");
    const sso = readTenantSso(tenant.metadata);
    return {
      slug: tenant.slug,
      ...sanitizeSsoForClient(sso),
    };
  }

  async updateConfig(
    user: RequestUser,
    payload: {
      enabled: boolean;
      providerLabel?: string;
      issuer?: string;
      clientId?: string;
      clientSecret?: string;
      scopes?: string[];
    },
  ) {
    const tenantId = requireTenantId(user);
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { metadata: true },
    });
    if (!tenant) throw new NotFoundException("Tenant não encontrado.");

    const meta = (tenant.metadata ?? {}) as TenantMetadataWithSso;
    const prev = meta.sso ?? ({} as TenantSsoConfig);

    const nextSso: TenantSsoConfig = {
      enabled: payload.enabled,
      providerLabel: payload.providerLabel?.trim() || prev.providerLabel,
      issuer: payload.issuer?.trim() || prev.issuer || "",
      clientId: payload.clientId?.trim() || prev.clientId || "",
      scopes: payload.scopes?.length ? payload.scopes : prev.scopes ?? ["openid", "profile", "email"],
      clientSecretEnc: prev.clientSecretEnc,
    };

    if (payload.clientSecret?.trim()) {
      nextSso.clientSecretEnc = encriptarPasswordWfa(
        payload.clientSecret.trim(),
        this.encryptionKey(),
      );
    }

    if (nextSso.enabled) {
      if (!nextSso.issuer || !nextSso.clientId) {
        throw new BadRequestException("Issuer e Client ID são obrigatórios com SSO activo.");
      }
      if (!nextSso.clientSecretEnc) {
        throw new BadRequestException("Client secret é obrigatório na primeira configuração SSO.");
      }
    }

    const next: TenantMetadataWithSso = { ...meta, sso: nextSso };
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { metadata: next as object },
    });

    return sanitizeSsoForClient(readTenantSso(next));
  }

  async getPublicConfig(tenantSlug: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { status: true, metadata: true },
    });
    if (!tenant || tenant.status === "SUSPENDED" || tenant.status === "ARCHIVED") {
      throw new NotFoundException("Entidade formadora não encontrada.");
    }
    const sso = readTenantSso(tenant.metadata);
    const pub = sanitizeSsoForClient(sso);
    const apiPublic = this.apiPublicUrl();
    return {
      ...pub,
      loginPath: pub.enabled
        ? `${apiPublic}/v1/auth/sso/start?slug=${encodeURIComponent(tenantSlug)}`
        : null,
    };
  }

  async startLogin(tenantSlug: string, res: Response) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { id: true, status: true, metadata: true },
    });
    if (!tenant || tenant.status === "SUSPENDED" || tenant.status === "ARCHIVED") {
      throw new NotFoundException("Entidade formadora não encontrada.");
    }
    const sso = readTenantSso(tenant.metadata);
    if (!sso?.clientSecretEnc) {
      throw new BadRequestException("SSO não configurado para este tenant.");
    }

    const discovery = await this.fetchDiscovery(sso.issuer);
    const codeVerifier = randomBytes(32).toString("base64url");
    const codeChallenge = createHash("sha256")
      .update(codeVerifier)
      .digest("base64url");
    const nonce = randomBytes(16).toString("hex");
    const state = await this.signState({ tenantSlug, codeVerifier, nonce });

    const apiPublic = this.apiPublicUrl();
    const redirectUri = `${apiPublic}/v1/auth/sso/callback`;

    const scopes = (sso.scopes ?? ["openid", "profile", "email"]).join(" ");
    const url = new URL(discovery.authorization_endpoint);
    url.searchParams.set("client_id", sso.clientId);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", scopes);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("nonce", nonce);
    url.searchParams.set("code_challenge", codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");

    res.redirect(url.toString());
  }

  async handleCallback(code: string, state: string, res: Response) {
    const payload = await this.verifyState(state);
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: payload.tenantSlug },
      select: { id: true, status: true, metadata: true },
    });
    if (!tenant || tenant.status === "SUSPENDED" || tenant.status === "ARCHIVED") {
      throw new UnauthorizedException("Tenant indisponível.");
    }
    const sso = readTenantSso(tenant.metadata);
    if (!sso?.clientSecretEnc) {
      throw new BadRequestException("SSO não configurado.");
    }

    const discovery = await this.fetchDiscovery(sso.issuer);
    const apiPublic = this.apiPublicUrl();
    const redirectUri = `${apiPublic}/v1/auth/sso/callback`;
    const clientSecret = desencriptarPasswordWfa(sso.clientSecretEnc, this.encryptionKey());

    const tokenRes = await fetch(discovery.token_endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: sso.clientId,
        client_secret: clientSecret,
        code_verifier: payload.codeVerifier,
      }),
    });

    if (!tokenRes.ok) {
      throw new UnauthorizedException("Falha na troca do código OAuth.");
    }

    const tokens = (await tokenRes.json()) as { id_token?: string };
    if (!tokens.id_token) {
      throw new UnauthorizedException("ID token em falta na resposta OAuth.");
    }

    const jwksUrl = `${discovery.issuer.replace(/\/$/, "")}/.well-known/jwks.json`;
    const { createRemoteJWKSet, jwtVerify: verifyJwt } = await import("jose");
    const jwks = createRemoteJWKSet(new URL(jwksUrl));
    const { payload: claims } = await verifyJwt(tokens.id_token, jwks, {
      issuer: discovery.issuer,
      audience: sso.clientId,
    });

    const email = String(claims.email ?? "").toLowerCase();
    const sub = String(claims.sub ?? "");
    if (!email || !sub) {
      throw new UnauthorizedException("Claims OAuth inválidas.");
    }

    let user = await this.prisma.user.findFirst({
      where: {
        tenantId: tenant.id,
        OR: [{ email }, { cognitoSub: sub }],
        active: true,
      },
      include: { tenant: true },
    });

    if (!user) {
      throw new UnauthorizedException("Utilizador não provisionado nesta entidade.");
    }

    if (!user.cognitoSub) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { cognitoSub: sub },
        include: { tenant: true },
      });
    }

    const login = await this.auth.completeLoginForUser(user, res);
    const webOrigin = (this.config.get<string>("APP_PUBLIC_URL") ?? "http://localhost:3000").replace(/\/$/, "");
    const redirect = `${webOrigin}/login?sso=ok`;
    if (login.accessToken) {
      res.redirect(`${redirect}&token=${encodeURIComponent(login.accessToken)}`);
      return;
    }
    res.redirect(redirect);
  }

  private apiPublicUrl(): string {
    const raw =
      this.config.get<string>("API_PUBLIC_URL") ??
      `http://localhost:${this.config.get<string>("API_PORT") ?? "4000"}`;
    return raw.replace(/\/$/, "");
  }

  private async fetchDiscovery(issuer: string): Promise<OidcDiscovery> {
    const base = issuer.replace(/\/$/, "");
    const res = await fetch(`${base}/.well-known/openid-configuration`);
    if (!res.ok) {
      throw new BadRequestException("Não foi possível obter metadata OpenID do issuer.");
    }
    return res.json() as Promise<OidcDiscovery>;
  }

  private async signState(payload: SsoStatePayload): Promise<string> {
    const secret = new TextEncoder().encode(this.config.getOrThrow<string>("JWT_SECRET"));
    return new SignJWT(payload as unknown as Record<string, unknown>)
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("15m")
      .setIssuedAt()
      .sign(secret);
  }

  private async verifyState(token: string): Promise<SsoStatePayload> {
    const secret = new TextEncoder().encode(this.config.getOrThrow<string>("JWT_SECRET"));
    const { payload } = await jwtVerify(token, secret);
    const tenantSlug = String(payload.tenantSlug ?? "");
    const codeVerifier = String(payload.codeVerifier ?? "");
    const nonce = String(payload.nonce ?? "");
    if (!tenantSlug || !codeVerifier || !nonce) {
      throw new UnauthorizedException("State SSO inválido.");
    }
    return { tenantSlug, codeVerifier, nonce };
  }
}
