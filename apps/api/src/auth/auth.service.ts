import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import type { Request, Response } from "express";
import type { Prisma, TenantUserRole } from "@nexiforma/database";
import type { JwtKind, JwtRole, MfaAppCode } from "@nexiforma/shared";
import { mfaAppDisplayLabel } from "@nexiforma/shared";
import { PrismaService } from "../prisma/prisma.service";
import {
  attachRefreshCookie,
  clearRefreshCookie,
  REFRESH_COOKIE_NAME,
} from "./auth-cookie.util";
import { parseJwtExpirySeconds } from "./jwt-expiry";
import type { PlatformLoginDto } from "./dto/platform-login.dto";
import type { TenantLoginDto } from "./dto/tenant-login.dto";
import type {
  PlatformForgotPasswordDto,
  PlatformResetPasswordDto,
  PreviewPasswordResetDto,
  TenantForgotPasswordDto,
  TenantResetPasswordDto,
} from "./dto/forgot-password.dto";
import type { UpdateOwnProfileDto, ChangeOwnPasswordDto } from "./dto/own-profile.dto";
import { MfaService } from "./mfa.service";
import { MailService } from "../mail/mail.service";
import {
  decryptPasswordResetUser,
  encryptPasswordResetUser,
  maskEmail,
} from "./password-reset-crypto.util";
import {
  hashPasswordResetToken,
  newPasswordResetOpaque,
} from "./password-reset.util";
import { hashRefreshToken, newRefreshOpaqueToken } from "./refresh-token.util";
import type { AccessTokenPayload } from "./types/access-token-payload";
import { LoginAttemptLimiterService } from "./login-attempt-limiter.service";
import { resolveTenantLoginLockoutPolicy } from "./login-lockout-policy.util";
import { AuditService } from "../audit/audit.service";
import {
  buildTenantAmbiguousPayload,
  buildTenantAuthPick,
  isTenantOperational,
  normalizeAuthEmail,
  tenantLoginLockoutKey,
} from "./tenant-auth-resolve.util";
import { matchPasswordHash, syncPasswordHashByEmail } from "./shared-password.util";
import { resolveAppPublicUrlForLinks } from "../common/app-public-url.util";

const PASSWORD_RESET_GENERIC =
  "Se existir uma conta com esse email, enviámos instruções para redefinir a palavra-passe.";

function mapPrismaRoleToJwt(role: TenantUserRole): JwtRole {
  switch (role) {
    case "ADMIN":
      return "tenant_manager";
    case "COORDENADOR_PEDAGOGICO":
    case "COORDENADOR": // legado
      return "coordenador_pedagogico";
    case "COORDENADOR_COMERCIAL":
      return "coordenador_comercial";
    case "COORDENADOR_FINANCEIRO":
    case "FINANCEIRO": // legado
      return "coordenador_financeiro";
    case "FORMADOR":
      return "formador";
    case "COMERCIAL":
      return "comercial";
    case "FORMANDO":
      return "formando";
    default:
      return "formando";
  }
}

export interface LoginResponse {
  accessToken?: string;
  tokenType?: "Bearer";
  expiresIn?: number;
  refreshExpiresIn?: number;
  refreshToken?: string;
  mfaRequired?: boolean;
  mfaEnrollmentRequired?: boolean;
  mfaToken?: string;
  passwordChangeRequired?: boolean;
  user: {
    id: string;
    email: string;
    role: JwtRole;
    kind: JwtKind;
    tenantId?: string | null;
    tenantSlug?: string | null;
    mfaApp?: MfaAppCode | null;
    mfaAppLabel?: string | null;
  };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly accessExpiresSeconds: number;
  private readonly refreshExpiresSeconds: number;
  private readonly refreshRememberExpiresSeconds: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mfa: MfaService,
    private readonly mail: MailService,
    private readonly loginAttempts: LoginAttemptLimiterService,
    private readonly audit: AuditService,
  ) {
    this.accessExpiresSeconds = parseJwtExpirySeconds(
      this.config.get<string>("JWT_EXPIRES") ?? "60m",
    );
    this.refreshExpiresSeconds = parseJwtExpirySeconds(
      this.config.get<string>("JWT_REFRESH_EXPIRES") ?? "7d",
    );
    this.refreshRememberExpiresSeconds = parseJwtExpirySeconds(
      this.config.get<string>("JWT_REFRESH_REMEMBER_EXPIRES") ?? "30d",
    );
  }

  private refreshPepper(): string {
    return (
      this.config.get<string>("JWT_REFRESH_PEPPER") ??
      `${this.config.getOrThrow<string>("JWT_SECRET")}:refresh_static_pepper_change_in_prod`
    );
  }

  private exposeRefreshInBody(): boolean {
    if (this.config.get<string>("REFRESH_TOKEN_BODY") === "true") return true;
    return this.config.get<string>("NODE_ENV") !== "production";
  }

  private tenantLoginKey(dto: TenantLoginDto, resolvedSlug?: string): string {
    return tenantLoginLockoutKey(dto.email, resolvedSlug ?? dto.tenantSlug);
  }

  private async resolveTenantLoginUser(dto: TenantLoginDto) {
    const email = normalizeAuthEmail(dto.email);
    const hintSlug = dto.tenantSlug?.trim() ?? "";

    const allByEmail = await this.prisma.user.findMany({
      where: {
        email,
        active: true,
        tenant: { status: { notIn: ["SUSPENDED", "ARCHIVED"] } },
      },
      include: { tenant: true },
    });

    if (allByEmail.length === 0) {
      throw new UnauthorizedException("Tenant ou credenciais inválidas.");
    }

    const matchedHash = await matchPasswordHash(
      allByEmail.map((u) => u.passwordHash),
      dto.password,
    );
    if (!matchedHash) {
      const anyLocalPassword = allByEmail.some((u) => Boolean(u.passwordHash));
      if (!anyLocalPassword) {
        throw new UnauthorizedException(
          "Esta conta usa login social (Google/Microsoft). Utilize o botão correspondente.",
        );
      }
      throw new UnauthorizedException("Tenant ou credenciais inválidas.");
    }

    // Mantém a mesma password em todas as entidades deste email.
    await syncPasswordHashByEmail(this.prisma, email, matchedHash);

    // Password partilhada por email. Slug guardado/errado não deve bloquear o login.
    if (hintSlug) {
      const hintedUser = allByEmail.find(
        (user) => user.tenant.slug.toLowerCase() === hintSlug.toLowerCase(),
      );
      if (hintedUser) return hintedUser;
      // Slug residual de outra sessão/email - ignora e resolve pelo email.
    }

    if (allByEmail.length > 1) {
      throw new UnauthorizedException(
        buildTenantAmbiguousPayload(
          allByEmail.map((user) =>
            buildTenantAuthPick({
              slug: user.tenant.slug,
              legalName: user.tenant.legalName,
              role: user.role,
              metadata: user.tenant.metadata,
            }),
          ),
        ),
      );
    }

    return allByEmail[0];
  }

  async loginTenant(
    dto: TenantLoginDto,
    res?: Response,
    actorIp?: string,
  ): Promise<LoginResponse> {
    const email = normalizeAuthEmail(dto.email);
    const preLockoutKey = tenantLoginLockoutKey(email, dto.tenantSlug);
    const hintedTenant = dto.tenantSlug?.trim()
      ? await this.prisma.tenant.findUnique({ where: { slug: dto.tenantSlug.trim() } })
      : null;
    const lockoutPolicy = hintedTenant
      ? resolveTenantLoginLockoutPolicy(hintedTenant.metadata)
      : resolveTenantLoginLockoutPolicy(null);

    await this.loginAttempts.assertNotLocked("tenant", preLockoutKey, lockoutPolicy);

    let user;
    try {
      user = await this.resolveTenantLoginUser(dto);
    } catch (err) {
      if (err instanceof UnauthorizedException) {
        const response = err.getResponse();
        if (
          typeof response === "object" &&
          response !== null &&
          "code" in response &&
          (response as { code?: string }).code === "TENANT_AMBIGUOUS"
        ) {
          throw err;
        }
      }
      await this.loginAttempts.recordFailure("tenant", preLockoutKey, lockoutPolicy);
      throw err;
    }

    const loginKey = this.tenantLoginKey(dto, user.tenant.slug);
    if (loginKey !== preLockoutKey) {
      await this.loginAttempts.assertNotLocked("tenant", loginKey, lockoutPolicy);
    }

    if (!isTenantOperational(user.tenant.status)) {
      await this.loginAttempts.recordFailure("tenant", loginKey, lockoutPolicy);
      throw new UnauthorizedException("Conta da entidade formadora suspensa ou arquivada.");
    }

    if (!user.emailVerifiedAt) {
      await this.loginAttempts.clear("tenant", loginKey);
      throw new UnauthorizedException({
        statusCode: 401,
        error: "Unauthorized",
        code: "EMAIL_NOT_VERIFIED",
        message:
          "Confirme o seu email antes de iniciar sessão. Verifique a caixa de entrada ou peça um novo link de confirmação.",
        tenantSlug: user.tenant.slug,
        email: user.email,
      });
    }

    await this.loginAttempts.clear("tenant", loginKey);

    const role = mapPrismaRoleToJwt(user.role);

    if (this.mfa.mustEnroll({
      role: user.role,
      mfaEnabled: user.mfaEnabled,
      mfaRequired: user.mfaRequired,
    })) {
      return {
        mfaEnrollmentRequired: true,
        mfaToken: this.mfa.createEnrollmentToken(user.id),
        user: {
          id: user.id,
          email: user.email,
          role,
          kind: "tenant",
          tenantId: user.tenantId,
          tenantSlug: user.tenant.slug,
        },
      };
    }

    if (this.mfa.requiresMfaForRole(user.role, user.mfaEnabled)) {
      const mfaApp = user.mfaApp as MfaAppCode | null;
      return {
        mfaRequired: true,
        mfaToken: this.mfa.createPendingToken(user.id),
        user: {
          id: user.id,
          email: user.email,
          role,
          kind: "tenant",
          tenantId: user.tenantId,
          tenantSlug: user.tenant.slug,
          mfaApp,
          mfaAppLabel: mfaAppDisplayLabel(mfaApp),
        },
      };
    }

    const payload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      kind: "tenant",
      role,
      tenantId: user.tenantId,
      tenantSlug: user.tenant.slug,
      ...(user.mustChangePassword ? { mustChangePassword: true } : {}),
    };
    const login = await this.completeLogin(
      payload,
      user.id,
      user.email,
      "tenant",
      res,
      dto.rememberMe === true,
      { actorIp },
    );
    return {
      ...login,
      ...(user.mustChangePassword ? { passwordChangeRequired: true } : {}),
    };
  }

  async verifyMfaLogin(
    mfaToken: string,
    code: string,
    res?: Response,
    rememberMe?: boolean,
  ): Promise<LoginResponse> {
    const userId = await this.mfa.verifyPendingToken(mfaToken).catch(() => {
      throw new UnauthorizedException("Sessão MFA expirada.");
    });
    const mfaKey = `mfa:${userId}`;
    await this.loginAttempts.assertNotLocked("platform", mfaKey);
    const ok = await this.mfa.verifyCode(userId, code);
    if (!ok) {
      await this.loginAttempts.recordFailure("platform", mfaKey);
      throw new UnauthorizedException("Código MFA inválido.");
    }
    await this.loginAttempts.clear("platform", mfaKey);
    const user = await this.prisma.user.findFirst({
      where: { id: userId, active: true },
      include: { tenant: true },
    });
    if (!user) {
      throw new UnauthorizedException("Utilizador inválido.");
    }
    return this.completeLoginForUser(user, res, rememberMe === true);
  }

  async mfaEnrollSetup(mfaToken: string) {
    const userId = await this.mfa.verifyEnrollmentToken(mfaToken);
    const user = await this.prisma.user.findFirst({
      where: { id: userId, active: true },
    });
    if (!user) {
      throw new UnauthorizedException("Utilizador inválido.");
    }
    if (user.mfaEnabled) {
      throw new BadRequestException("MFA já está activo nesta conta.");
    }
    return this.mfa.setupForUser(user.id, user.email, user.tenantId);
  }

  async mfaEnrollConfirm(
    mfaToken: string,
    code: string,
    mfaApp: MfaAppCode,
    res?: Response,
    rememberMe?: boolean,
  ): Promise<LoginResponse> {
    const userId = await this.mfa.verifyEnrollmentToken(mfaToken);
    const user = await this.prisma.user.findFirst({
      where: { id: userId, active: true },
      include: { tenant: true },
    });
    if (!user) {
      throw new UnauthorizedException("Utilizador inválido.");
    }
    await this.mfa.confirmSetupForUser(user.id, user.tenantId, code, mfaApp);
    const refreshed = await this.prisma.user.findFirst({
      where: { id: userId, active: true },
      include: { tenant: true },
    });
    if (!refreshed) {
      throw new UnauthorizedException("Utilizador inválido.");
    }
    return this.completeLoginForUser(refreshed, res, rememberMe === true);
  }

  completeLoginForUser(
    user: {
      id: string;
      email: string;
      role: TenantUserRole;
      tenantId: string;
      tenant: { slug: string };
      mustChangePassword?: boolean;
    },
    res?: Response,
    rememberMe?: boolean,
    opts?: { includeRefreshOpaque?: boolean },
  ): Promise<LoginResponse> {
    const payload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      kind: "tenant",
      role: mapPrismaRoleToJwt(user.role),
      tenantId: user.tenantId,
      tenantSlug: user.tenant.slug,
      ...(user.mustChangePassword ? { mustChangePassword: true } : {}),
    };
    const login = this.completeLogin(
      payload,
      user.id,
      user.email,
      "tenant",
      res,
      rememberMe === true,
      opts,
    );
    return login.then((body) => ({
      ...body,
      ...(user.mustChangePassword ? { passwordChangeRequired: true } : {}),
    }));
  }

  async loginPlatform(
    dto: PlatformLoginDto,
    res?: Response,
    actorIp?: string,
  ): Promise<LoginResponse> {
    const loginKey = dto.email.trim().toLowerCase();
    await this.loginAttempts.assertNotLocked("platform", loginKey);

    const pu = await this.prisma.platformUser.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (!pu?.active) {
      await this.loginAttempts.recordFailure("platform", loginKey);
      throw new UnauthorizedException("Credenciais inválidas.");
    }
    let ok = false;
    try {
      ok = await argon2.verify(pu.passwordHash, dto.password);
    } catch {
      ok = false;
    }
    if (!ok) {
      await this.loginAttempts.recordFailure("platform", loginKey);
      throw new UnauthorizedException("Credenciais inválidas.");
    }

    await this.loginAttempts.clear("platform", loginKey);

    const payload: AccessTokenPayload = {
      sub: pu.id,
      email: pu.email,
      kind: "platform",
      role: "super_admin",
      tenantId: null,
      tenantSlug: null,
    };
    return this.completeLogin(payload, pu.id, pu.email, "platform", res, dto.rememberMe === true, {
      actorIp,
    });
  }

  private passwordResetPepper(): string {
    return (
      this.config.get<string>("PASSWORD_RESET_PEPPER") ??
      `${this.config.getOrThrow<string>("JWT_SECRET")}:password_reset`
    );
  }

  private passwordResetTtlMinutes(): number {
    return Number(this.config.get<string>("PASSWORD_RESET_TTL_MINUTES") ?? 60);
  }

  private passwordResetEncryptionKey(): string {
    return (
      this.config.get<string>("PASSWORD_RESET_ENCRYPTION_KEY") ??
      this.config.getOrThrow<string>("JWT_SECRET")
    );
  }

  async previewTenantPasswordReset(dto: PreviewPasswordResetDto) {
    return this.previewPasswordReset(dto, "tenant");
  }

  async previewPlatformPasswordReset(dto: PreviewPasswordResetDto) {
    return this.previewPasswordReset(dto, "platform");
  }

  private async previewPasswordReset(dto: PreviewPasswordResetDto, expectedKind: "tenant" | "platform") {
    const row = await this.findValidPasswordResetToken(dto.token);
    if (row.subjectKind !== expectedKind) {
      throw new UnauthorizedException("Link inválido ou expirado.");
    }
    this.assertPasswordResetUserRef(row, dto.userRef, dto.tenantSlug);

    let mfaRequired = false;
    let mfaAppLabel: string | undefined;
    if (expectedKind === "tenant") {
      const siblings = await this.prisma.user.findMany({
        where: { email: normalizeAuthEmail(row.email), active: true },
        select: { mfaEnabled: true, mfaApp: true },
      });
      const mfaUser = siblings.find((u) => u.mfaEnabled);
      mfaRequired = Boolean(mfaUser);
      if (mfaRequired) {
        mfaAppLabel = mfaAppDisplayLabel(mfaUser?.mfaApp);
      }
    }

    return {
      valid: true,
      mfaRequired,
      mfaAppLabel,
      emailHint: maskEmail(row.email),
      tenantSlug: row.tenantSlug ?? undefined,
    };
  }

  async requestTenantPasswordReset(
    dto: TenantForgotPasswordDto,
    req?: Request,
  ): Promise<{ message: string }> {
    const email = normalizeAuthEmail(dto.email);
    const slug = dto.tenantSlug?.trim() ?? "";
    const appUrl = resolveAppPublicUrlForLinks(this.config, req);

    const candidates = await this.prisma.user.findMany({
      where: {
        email,
        active: true,
        tenant: slug
          ? { slug, status: { notIn: ["SUSPENDED", "ARCHIVED"] } }
          : { status: { notIn: ["SUSPENDED", "ARCHIVED"] } },
      },
      include: { tenant: true },
      orderBy: { createdAt: "asc" },
    });

    if (candidates.length === 0) {
      return { message: PASSWORD_RESET_GENERIC };
    }

    // Um único link por email: a password é partilhada entre entidades.
    const subject =
      candidates.find((u) => Boolean(u.passwordHash)) ??
      candidates.find((u) => u.mfaEnabled) ??
      candidates[0];

    await this.issuePasswordReset({
      subjectKind: "tenant",
      subjectId: subject.id,
      email,
      tenantSlug: subject.tenant.slug,
      appUrl,
    });
    return { message: PASSWORD_RESET_GENERIC };
  }

  async requestPlatformPasswordReset(
    dto: PlatformForgotPasswordDto,
    req?: Request,
  ): Promise<{ message: string }> {
    const email = dto.email.toLowerCase();
    const pu = await this.prisma.platformUser.findUnique({ where: { email } });
    if (!pu?.active) {
      return { message: PASSWORD_RESET_GENERIC };
    }

    await this.issuePasswordReset({
      subjectKind: "platform",
      subjectId: pu.id,
      email,
      tenantSlug: null,
      appUrl: resolveAppPublicUrlForLinks(this.config, req),
    });

    return { message: PASSWORD_RESET_GENERIC };
  }

  async confirmTenantPasswordReset(dto: TenantResetPasswordDto): Promise<{ message: string }> {
    const row = await this.findValidPasswordResetToken(dto.token);
    if (row.subjectKind !== "tenant") {
      throw new UnauthorizedException("Link inválido ou expirado.");
    }
    this.assertPasswordResetUserRef(row, dto.userRef, dto.tenantSlug);

    const siblings = await this.prisma.user.findMany({
      where: {
        email: normalizeAuthEmail(row.email),
        active: true,
      },
      select: { id: true, mfaEnabled: true, mfaApp: true },
    });
    if (!siblings.some((u) => u.id === row.subjectId)) {
      throw new UnauthorizedException("Link inválido ou expirado.");
    }

    const mfaUser = siblings.find((u) => u.mfaEnabled);
    if (mfaUser) {
      const code = dto.mfaCode?.trim();
      if (!code || code.length !== 6) {
        throw new BadRequestException(
          `Código de 6 dígitos obrigatório (${mfaAppDisplayLabel(mfaUser.mfaApp)}).`,
        );
      }
      const ok = await this.mfa.verifyCode(mfaUser.id, code);
      if (!ok) {
        throw new UnauthorizedException(
          `Código inválido. Verifica ${mfaAppDisplayLabel(mfaUser.mfaApp)}.`,
        );
      }
    }

    const passwordHash = await argon2.hash(dto.newPassword, { type: argon2.argon2id });
    await this.prisma.$transaction(async (tx) => {
      await syncPasswordHashByEmail(tx, row.email, passwordHash, {
        mustChangePassword: false,
      });
      await tx.passwordResetToken.update({
        where: { id: row.id },
        data: { usedAt: new Date() },
      });
      // Link de reset prova posse do email → confirma verificação.
      await tx.user.updateMany({
        where: {
          email: normalizeAuthEmail(row.email),
          active: true,
          emailVerifiedAt: null,
        },
        data: { emailVerifiedAt: new Date() },
      });
      await tx.emailConfirmationToken.deleteMany({
        where: { userId: { in: siblings.map((s) => s.id) }, usedAt: null },
      });
    });

    for (const sibling of siblings) {
      await this.revokeAllRefreshSessionsForSubject("tenant", sibling.id);
    }

    return { message: "Palavra-passe actualizada. Podes iniciar sessão." };
  }

  async confirmPlatformPasswordReset(dto: PlatformResetPasswordDto): Promise<{ message: string }> {
    const row = await this.findValidPasswordResetToken(dto.token);
    if (row.subjectKind !== "platform") {
      throw new UnauthorizedException("Link inválido ou expirado.");
    }
    this.assertPasswordResetUserRef(row, dto.userRef, undefined);

    const passwordHash = await argon2.hash(dto.newPassword, { type: argon2.argon2id });
    await this.prisma.$transaction([
      this.prisma.platformUser.update({
        where: { id: row.subjectId },
        data: { passwordHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: row.id },
        data: { usedAt: new Date() },
      }),
    ]);

    await this.revokeAllRefreshSessionsForSubject(row.subjectKind, row.subjectId);

    return { message: "Palavra-passe actualizada. Podes iniciar sessão." };
  }

  async sendTenantUserPasswordReset(
    userId: string,
    req?: { headers: Record<string, string | string[] | undefined> },
  ): Promise<string> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, active: true },
      include: { tenant: { select: { slug: true } } },
    });
    if (!user) {
      throw new BadRequestException("Utilizador não encontrado ou inactivo.");
    }

    return this.issuePasswordReset({
      subjectKind: "tenant",
      subjectId: user.id,
      email: user.email,
      tenantSlug: user.tenant.slug,
      appUrl: resolveAppPublicUrlForLinks(this.config, req),
    });
  }

  private async issuePasswordReset(input: {
    subjectKind: "tenant" | "platform";
    subjectId: string;
    email: string;
    tenantSlug: string | null;
    appUrl: string;
  }): Promise<string> {
    const pepper = this.passwordResetPepper();
    const { raw, hash } = newPasswordResetOpaque(pepper);
    const ttlMin = this.passwordResetTtlMinutes();
    const expiresAt = new Date(Date.now() + ttlMin * 60_000);

    await this.prisma.passwordResetToken.deleteMany({
      where: {
        subjectKind: input.subjectKind,
        subjectId: input.subjectId,
        usedAt: null,
      },
    });

    await this.prisma.passwordResetToken.create({
      data: {
        tokenHash: hash,
        subjectKind: input.subjectKind,
        subjectId: input.subjectId,
        tenantSlug: input.tenantSlug,
        email: input.email,
        expiresAt,
      },
    });

    const appUrl = input.appUrl.replace(/\/$/, "");
    const qs = new URLSearchParams({ token: raw });
    if (input.tenantSlug) qs.set("slug", input.tenantSlug);

    const userRef = encryptPasswordResetUser(
      {
        sid: input.subjectId,
        kind: input.subjectKind,
        email: input.email,
        slug: input.tenantSlug ?? undefined,
      },
      this.passwordResetEncryptionKey(),
    );
    qs.set("u", userRef);

    const resetUrl = `${appUrl}/login/recuperar?${qs.toString()}`;

    const tenantUsers =
      input.subjectKind === "tenant"
        ? await this.prisma.user.findMany({
            where: { email: normalizeAuthEmail(input.email), active: true },
            select: { mfaEnabled: true, mfaApp: true },
          })
        : [];
    const mfaUser = tenantUsers.find((u) => u.mfaEnabled);

    await this.mail.sendPasswordReset(input.email, resetUrl, ttlMin, {
      mfaRequired: Boolean(mfaUser),
      mfaAppLabel: mfaUser ? mfaAppDisplayLabel(mfaUser.mfaApp) : undefined,
    }).catch((err: unknown) => {
      this.logger.error(
        `Falha ao enviar email de reset para ${input.email}: ${err instanceof Error ? err.message : String(err)}`,
      );
      if (this.config.get<string>("NODE_ENV") === "production") {
        throw err;
      }
    });

    if (this.config.get<string>("NODE_ENV") !== "production") {
      this.logger.log(`[dev] password reset link: ${resetUrl}`);
    }

    return resetUrl;
  }

  private async findValidPasswordResetToken(rawToken: string) {
    const pepper = this.passwordResetPepper();
    const tokenHash = hashPasswordResetToken(pepper, rawToken);
    const row = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });
    if (!row || row.usedAt || row.expiresAt <= new Date()) {
      throw new UnauthorizedException("Link inválido ou expirado.");
    }
    return row;
  }

  private assertPasswordResetUserRef(
    row: {
      subjectId: string;
      subjectKind: string;
      email: string;
      tenantSlug: string | null;
    },
    userRef: string | undefined,
    tenantSlug: string | undefined,
  ): void {
    if (tenantSlug?.trim() && row.tenantSlug && row.tenantSlug !== tenantSlug.trim()) {
      throw new UnauthorizedException("Link inválido ou expirado.");
    }
    if (!userRef?.trim()) {
      throw new UnauthorizedException("Link inválido ou expirado.");
    }
    try {
      const payload = decryptPasswordResetUser(userRef.trim(), this.passwordResetEncryptionKey());
      if (
        payload.sid !== row.subjectId ||
        payload.kind !== row.subjectKind ||
        payload.email.toLowerCase() !== row.email.toLowerCase()
      ) {
        throw new UnauthorizedException("Link inválido ou expirado.");
      }
      if (row.tenantSlug && payload.slug && payload.slug !== row.tenantSlug) {
        throw new UnauthorizedException("Link inválido ou expirado.");
      }
    } catch (e) {
      if (e instanceof UnauthorizedException) throw e;
      throw new UnauthorizedException("Link inválido ou expirado.");
    }
  }

  /** @deprecated Usar requestTenantPasswordReset + confirmTenantPasswordReset */
  async resetTenantPassword(dto: TenantForgotPasswordDto & { newPassword?: string }): Promise<{ message: string }> {
    if (dto.newPassword) {
      throw new UnauthorizedException(
        "Redefinição directa desactivada. Solicita um link por email em /login/recuperar.",
      );
    }
    return this.requestTenantPasswordReset(dto);
  }

  /** @deprecated Usar requestPlatformPasswordReset + confirmPlatformPasswordReset */
  async resetPlatformPassword(dto: PlatformForgotPasswordDto & { newPassword?: string }): Promise<{ message: string }> {
    if (dto.newPassword) {
      throw new UnauthorizedException(
        "Redefinição directa desactivada. Solicita um link por email em /login/recuperar.",
      );
    }
    return this.requestPlatformPasswordReset(dto);
  }

  async refreshFromCookie(req: Request, res: Response): Promise<LoginResponse> {
    const raw = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
    if (!raw || typeof raw !== "string") {
      throw new UnauthorizedException("Sessão de refresh em falta.");
    }

    const hash = hashRefreshToken(this.refreshPepper(), raw);
    const session = await this.prisma.authRefreshSession.findUnique({
      where: { tokenHash: hash },
    });

    const now = new Date();

    /** Token de refresh já rotado/revogado reutilizado → possível roubo (MITM) ou corrida concorrente. */
    if (session?.revokedAt) {
      const revokedSec = (now.getTime() - session.revokedAt.getTime()) / 1000;
      if (revokedSec <= 30) {
        // Corrida concorrente de pedidos paralelos: devolver token para a sessão ativa recente
        const active = await this.prisma.authRefreshSession.findFirst({
          where: {
            subjectId: session.subjectId,
            subjectKind: session.subjectKind,
            revokedAt: null,
            expiresAt: { gt: now },
          },
          orderBy: { createdAt: "desc" },
        });
        if (active) {
          if (session.subjectKind === "platform") {
            const pu = await this.prisma.platformUser.findFirst({
              where: { id: session.subjectId, active: true },
            });
            if (pu) {
              const payload: AccessTokenPayload = {
                sub: pu.id,
                email: pu.email,
                kind: "platform",
                role: "super_admin",
                tenantId: null,
                tenantSlug: null,
              };
              return {
                accessToken: this.signAccessToken(payload),
                tokenType: "Bearer",
                expiresIn: this.accessExpiresSeconds,
                refreshExpiresIn: Math.max(1, Math.floor((active.expiresAt.getTime() - now.getTime()) / 1000)),
                user: {
                  id: pu.id,
                  email: pu.email,
                  role: "super_admin",
                  kind: "platform",
                },
              };
            }
          } else {
            const user = await this.prisma.user.findFirst({
              where: { id: session.subjectId, active: true },
              include: { tenant: true },
            });
            if (user) {
              const payloadTenant: AccessTokenPayload = {
                sub: user.id,
                email: user.email,
                kind: "tenant",
                role: mapPrismaRoleToJwt(user.role),
                tenantId: user.tenantId,
                tenantSlug: user.tenant.slug,
                ...(user.mustChangePassword ? { mustChangePassword: true } : {}),
              };
              return {
                accessToken: this.signAccessToken(payloadTenant),
                tokenType: "Bearer",
                expiresIn: this.accessExpiresSeconds,
                refreshExpiresIn: Math.max(1, Math.floor((active.expiresAt.getTime() - now.getTime()) / 1000)),
                user: {
                  id: user.id,
                  email: user.email,
                  role: payloadTenant.role,
                  kind: "tenant",
                  tenantId: user.tenantId,
                  tenantSlug: user.tenant.slug,
                },
              };
            }
          }
        }
      }

      await this.prisma.authRefreshSession.updateMany({
        where: {
          subjectId: session.subjectId,
          subjectKind: session.subjectKind,
          revokedAt: null,
        },
        data: { revokedAt: now },
      });
      clearRefreshCookie(res, this.config);
      throw new UnauthorizedException(
        "Sessão comprometida - todas as sessões foram terminadas. Inicie sessão novamente.",
      );
    }

    if (!session || session.expiresAt <= now) {
      clearRefreshCookie(res, this.config);
      throw new UnauthorizedException("Sessão expirada ou inválida.");
    }

    const subjectKind = session.subjectKind;
    if (subjectKind !== "tenant" && subjectKind !== "platform") {
      clearRefreshCookie(res, this.config);
      throw new UnauthorizedException("Sessão inválida.");
    }

    /** Rotação: revoga a sessão antiga antes de criar nova (reuse detection). */
    await this.prisma.authRefreshSession.update({
      where: { id: session.id },
      data: { revokedAt: now },
    });

    if (subjectKind === "platform") {
      const pu = await this.prisma.platformUser.findFirst({
        where: { id: session.subjectId, active: true },
      });
      if (!pu) {
        throw new UnauthorizedException("Utilizador de plataforma inexistente ou inativo.");
      }
      const payload: AccessTokenPayload = {
        sub: pu.id,
        email: pu.email,
        kind: "platform",
        role: "super_admin",
        tenantId: null,
        tenantSlug: null,
      };
      return this.completeLogin(payload, pu.id, pu.email, "platform", res);
    }

    const user = await this.prisma.user.findFirst({
      where: { id: session.subjectId, active: true },
      include: { tenant: true },
    });
    if (!user) {
      throw new UnauthorizedException("Utilizador do tenant inexistente ou inativo.");
    }
    const payloadTenant: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      kind: "tenant",
      role: mapPrismaRoleToJwt(user.role),
      tenantId: user.tenantId,
      tenantSlug: user.tenant.slug,
    };
    return this.completeLogin(payloadTenant, user.id, user.email, "tenant", res);
  }

  async logoutFromCookie(req: Request, res: Response): Promise<void> {
    const raw = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
    clearRefreshCookie(res, this.config);
    if (raw && typeof raw === "string") {
      const hash = hashRefreshToken(this.refreshPepper(), raw);
      await this.prisma.authRefreshSession.updateMany({
        where: { tokenHash: hash, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
  }

  async endImpersonation(
    user: AccessTokenPayload,
    req: Request,
    res: Response,
  ): Promise<LoginResponse | { ok: true }> {
    if (user.impersonationSessionId) {
      const session = await this.prisma.impersonationSession.findUnique({
        where: { id: user.impersonationSessionId },
      });
      if (session) {
        await this.prisma.impersonationSession.update({
          where: { id: session.id },
          data: { revokedAt: new Date() },
        });

        const pu = await this.prisma.platformUser.findFirst({
          where: { id: session.superAdminId, active: true },
        });
        if (pu) {
          const payload: AccessTokenPayload = {
            sub: pu.id,
            email: pu.email,
            kind: "platform",
            role: "super_admin",
            tenantId: null,
            tenantSlug: null,
          };
          return this.completeLoginWithPayload(payload, res);
        }
      }
    }
    await this.logoutFromCookie(req, res);
    return { ok: true };
  }

  private signAccessToken(payload: AccessTokenPayload): string {
    return this.jwt.sign(
      {
        sub: payload.sub,
        email: payload.email,
        kind: payload.kind,
        role: payload.role,
        ...(payload.kind === "tenant"
          ? {
              tenantId: payload.tenantId,
              tenantSlug: payload.tenantSlug ?? undefined,
              impersonating: payload.impersonating,
              impersonationSessionId: payload.impersonationSessionId,
              readOnlyImpersonation: payload.readOnlyImpersonation,
              jwtJti: payload.jwtJti,
              mustChangePassword: payload.mustChangePassword,
            }
          : {}),
      },
      { expiresIn: this.accessExpiresSeconds },
    );
  }

  /** Login com payload já montado (ex.: personificação super-admin ou SSO plataforma). */
  completeLoginWithPayload(
    payload: AccessTokenPayload,
    res?: Response,
    opts?: { includeRefreshOpaque?: boolean },
  ): Promise<LoginResponse> {
    return this.completeLogin(payload, payload.sub, payload.email, payload.kind, res, false, opts);
  }

  /** Termina todas as sessões refresh activas de um utilizador (login único). */
  async revokeAllRefreshSessionsForSubject(
    subjectKind: "tenant" | "platform",
    subjectId: string,
  ): Promise<void> {
    await this.revokeOtherRefreshSessions(subjectKind, subjectId);
  }

  private async revokeOtherRefreshSessions(
    subjectKind: "tenant" | "platform",
    subjectId: string,
  ): Promise<void> {
    /** Apaga sessões (não marca revokedAt) para não acionar detecção de roubo no refresh. */
    await this.prisma.authRefreshSession.deleteMany({
      where: {
        subjectKind,
        subjectId,
        revokedAt: null,
      },
    });
  }

  private async completeLogin(
    payload: AccessTokenPayload,
    userIdForResponse: string,
    emailForResponse: string,
    subjectKind: "tenant" | "platform",
    res?: Response,
    rememberMe?: boolean,
    opts?: { includeRefreshOpaque?: boolean; actorIp?: string; skipLoginAudit?: boolean },
  ): Promise<LoginResponse> {
    const accessToken = this.signAccessToken(payload);
    const opaque = newRefreshOpaqueToken();
    const tokenHash = hashRefreshToken(this.refreshPepper(), opaque);
    const refreshSec = rememberMe ? this.refreshRememberExpiresSeconds : this.refreshExpiresSeconds;

    /** Uma sessão activa por utilizador: novo login invalida dispositivos anteriores. */
    await this.revokeOtherRefreshSessions(subjectKind, payload.sub);

    await this.prisma.authRefreshSession.create({
      data: {
        tokenHash,
        subjectKind,
        subjectId: payload.sub,
        expiresAt: new Date(Date.now() + refreshSec * 1000),
      },
    });

    if (res) {
      attachRefreshCookie(res, this.config, opaque, refreshSec);
    }

    const body: LoginResponse = {
      accessToken,
      tokenType: "Bearer",
      expiresIn: this.accessExpiresSeconds,
      refreshExpiresIn: refreshSec,
      user: {
        id: userIdForResponse,
        email: emailForResponse,
        role: payload.role,
        kind: payload.kind,
        tenantId: payload.tenantId ?? undefined,
        tenantSlug: payload.tenantSlug ?? undefined,
      },
    };

    if (this.exposeRefreshInBody() || opts?.includeRefreshOpaque) {
      body.refreshToken = opaque;
    }

    if (!opts?.skipLoginAudit) {
      void this.audit
        .log({
          actorType: subjectKind === "platform" ? "SUPERADMIN_USER" : "TENANT_USER",
          actorId: payload.sub,
          actorIp: opts?.actorIp,
          action: "auth.login",
          resourceType: subjectKind === "platform" ? "platform_user" : "user",
          resourceId: payload.sub,
          targetTenantId: payload.tenantId ?? undefined,
          targetUserId: subjectKind === "tenant" ? payload.sub : undefined,
          payload: {
            role: payload.role,
            email: emailForResponse,
            rememberMe: rememberMe === true,
          },
        })
        .catch((err) => {
          this.logger.warn(`Falha ao registar auditoria de login: ${String(err)}`);
        });
    }

    return body;
  }

  /** Conclui sessão OAuth no domínio web (cookie refresh via BFF). */
  async completeOAuthExchange(
    refreshOpaque: string,
    tenantSlug: string,
    res?: Response,
  ): Promise<LoginResponse> {
    const tokenHash = hashRefreshToken(this.refreshPepper(), refreshOpaque);
    const session = await this.prisma.authRefreshSession.findFirst({
      where: {
        tokenHash,
        expiresAt: { gt: new Date() },
      },
    });
    if (!session) {
      throw new UnauthorizedException("Sessão OAuth expirada ou inválida.");
    }

    const refreshSec = Math.max(
      1,
      Math.floor((session.expiresAt.getTime() - Date.now()) / 1000),
    );
    if (res) {
      attachRefreshCookie(res, this.config, refreshOpaque, refreshSec);
    }

    if (session.subjectKind === "platform") {
      const pu = await this.prisma.platformUser.findFirst({
        where: { id: session.subjectId, active: true },
      });
      if (!pu) {
        throw new UnauthorizedException("Sessão OAuth inválida para plataforma.");
      }
      const payload: AccessTokenPayload = {
        sub: pu.id,
        email: pu.email,
        kind: "platform",
        role: "super_admin",
        tenantId: null,
        tenantSlug: null,
      };
      return {
        accessToken: this.signAccessToken(payload),
        tokenType: "Bearer",
        expiresIn: this.accessExpiresSeconds,
        refreshExpiresIn: refreshSec,
        user: {
          id: pu.id,
          email: pu.email,
          role: "super_admin",
          kind: "platform",
          tenantId: null,
          tenantSlug: null,
        },
      };
    }

    const user = await this.prisma.user.findFirst({
      where: { id: session.subjectId, active: true },
      include: { tenant: true },
    });
    if (!user || (tenantSlug && user.tenant.slug !== tenantSlug)) {
      throw new UnauthorizedException("Sessão OAuth inválida para esta entidade.");
    }

    const payload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      kind: "tenant",
      role: mapPrismaRoleToJwt(user.role),
      tenantId: user.tenantId,
      tenantSlug: user.tenant.slug,
      ...(user.mustChangePassword ? { mustChangePassword: true } : {}),
    };

    return {
      accessToken: this.signAccessToken(payload),
      tokenType: "Bearer",
      expiresIn: this.accessExpiresSeconds,
      refreshExpiresIn: refreshSec,
      user: {
        id: user.id,
        email: user.email,
        role: payload.role,
        kind: "tenant",
        tenantId: user.tenantId,
        tenantSlug: user.tenant.slug,
      },
      ...(user.mustChangePassword ? { passwordChangeRequired: true } : {}),
    };
  }

  async changeRequiredPassword(
    user: AccessTokenPayload,
    dto: { currentPassword: string; newPassword: string },
    res?: Response,
  ): Promise<LoginResponse> {
    if (user.kind !== "tenant" || !user.mustChangePassword) {
      throw new BadRequestException("Redefinição de password não aplicável.");
    }
    const row = await this.prisma.user.findFirst({
      where: { id: user.sub, tenantId: user.tenantId ?? undefined, active: true },
      include: { tenant: true },
    });
    if (!row?.passwordHash) {
      throw new UnauthorizedException("Utilizador inválido.");
    }
    const ok = await argon2.verify(row.passwordHash, dto.currentPassword);
    if (!ok) {
      throw new UnauthorizedException("Password actual incorrecta.");
    }
    const passwordHash = await argon2.hash(dto.newPassword, { type: argon2.argon2id });
    await syncPasswordHashByEmail(this.prisma, row.email, passwordHash, {
      mustChangePassword: false,
    });
    return this.completeLoginForUser(
      { ...row, mustChangePassword: false },
      res,
    );
  }

  async meProfile(user: AccessTokenPayload): Promise<
    AccessTokenPayload & {
      displayName?: string | null;
      uiTheme?: string | null;
      mfaEnabled?: boolean;
      mfaRequired?: boolean;
      mfaApp?: string | null;
      mfaAppLabel?: string | null;
      emailVerifiedAt?: Date | null;
      createdAt?: Date;
      tenantLegalName?: string | null;
      tenantLogoUrl?: string | null;
    }
  > {
    if (user.kind === "platform") {
      const pu = await this.prisma.platformUser.findUnique({
        where: { id: user.sub },
        select: {
          email: true,
          displayName: true,
          uiPreferences: true,
          createdAt: true,
        },
      });
      return {
        ...user,
        email: pu?.email ?? user.email,
        displayName: pu?.displayName ?? null,
        uiTheme: this.readUiTheme(pu?.uiPreferences),
        createdAt: pu?.createdAt,
      };
    }

    const tenantUser = user.tenantId
      ? await this.prisma.user.findFirst({
          where: { id: user.sub, tenantId: user.tenantId },
          include: {
            tenant: true,
          },
        })
      : null;

    const mfaApp = tenantUser?.mfaApp as MfaAppCode | null;

    return {
      ...user,
      email: tenantUser?.email ?? user.email,
      displayName: tenantUser?.displayName ?? null,
      uiTheme: this.readUiTheme(tenantUser?.uiPreferences),
      mfaEnabled: tenantUser?.mfaEnabled ?? false,
      mfaRequired: tenantUser?.mfaRequired ?? false,
      mfaApp,
      mfaAppLabel: mfaAppDisplayLabel(mfaApp),
      emailVerifiedAt: tenantUser?.emailVerifiedAt,
      createdAt: tenantUser?.createdAt,
      tenantLegalName: tenantUser?.tenant?.legalName ?? null,
      tenantSlug: tenantUser?.tenant?.slug ?? user.tenantSlug,
    };
  }

  async updateOwnProfile(
    user: AccessTokenPayload,
    dto: UpdateOwnProfileDto,
  ): Promise<{ message: string; displayName: string | null }> {
    const nextName = dto.displayName?.trim() || null;
    if (user.kind === "platform") {
      await this.prisma.platformUser.update({
        where: { id: user.sub },
        data: { displayName: nextName ?? undefined },
      });
      return { message: "Perfil actualizado.", displayName: nextName };
    }

    if (!user.tenantId) throw new BadRequestException("Sessão sem tenant.");
    await this.prisma.user.updateMany({
      where: { id: user.sub, tenantId: user.tenantId },
      data: { displayName: nextName ?? undefined },
    });
    return { message: "Perfil actualizado.", displayName: nextName };
  }

  async changeOwnPassword(
    user: AccessTokenPayload,
    dto: ChangeOwnPasswordDto,
  ): Promise<{ message: string }> {
    if (user.kind === "platform") {
      const pu = await this.prisma.platformUser.findUnique({
        where: { id: user.sub },
      });
      if (!pu?.passwordHash) {
        throw new BadRequestException("Conta sem palavra-passe local.");
      }
      const ok = await argon2.verify(pu.passwordHash, dto.currentPassword);
      if (!ok) {
        throw new UnauthorizedException("Palavra-passe actual incorrecta.");
      }
      const passwordHash = await argon2.hash(dto.newPassword, { type: argon2.argon2id });
      await this.prisma.platformUser.update({
        where: { id: pu.id },
        data: { passwordHash },
      });
      return { message: "Palavra-passe actualizada com sucesso." };
    }

    if (!user.tenantId) throw new BadRequestException("Sessão sem tenant.");
    const tu = await this.prisma.user.findFirst({
      where: { id: user.sub, tenantId: user.tenantId },
    });
    if (!tu?.passwordHash) {
      throw new BadRequestException("Conta sem palavra-passe local.");
    }
    const ok = await argon2.verify(tu.passwordHash, dto.currentPassword);
    if (!ok) {
      throw new UnauthorizedException("Palavra-passe actual incorrecta.");
    }
    const passwordHash = await argon2.hash(dto.newPassword, { type: argon2.argon2id });
    await syncPasswordHashByEmail(this.prisma, tu.email, passwordHash);
    return { message: "Palavra-passe actualizada com sucesso." };
  }

  private readUiTheme(prefs: unknown): string | null {
    if (!prefs || typeof prefs !== "object" || Array.isArray(prefs)) return null;
    const theme = (prefs as { uiTheme?: unknown }).uiTheme;
    return typeof theme === "string" && theme.trim() ? theme.trim() : null;
  }

  private static readonly UI_THEMES = new Set([
    "midnight",
    "graphite",
    "violet-night",
    "ocean",
    "forest",
    "snow-azure",
    "snow-rose",
    "snow-emerald",
    "snow-amber",
    "snow-violet",
  ]);

  async updateUiPreferences(
    user: AccessTokenPayload,
    dto: { uiTheme?: string },
  ): Promise<{ uiTheme: string | null }> {
    const theme =
      typeof dto.uiTheme === "string" && AuthService.UI_THEMES.has(dto.uiTheme)
        ? dto.uiTheme
        : null;
    if (dto.uiTheme !== undefined && !theme) {
      throw new BadRequestException("Tema inválido.");
    }

    if (user.kind === "platform") {
      const pu = (await this.prisma.platformUser.findUnique({
        where: { id: user.sub },
        select: { uiPreferences: true } as { uiPreferences: true },
      })) as { uiPreferences?: unknown } | null;
      if (!pu) throw new NotFoundException("Utilizador não encontrado.");
      const prev =
        pu.uiPreferences && typeof pu.uiPreferences === "object" && !Array.isArray(pu.uiPreferences)
          ? (pu.uiPreferences as Record<string, unknown>)
          : {};
      const next = { ...prev, ...(theme ? { uiTheme: theme } : {}) };
      await this.prisma.platformUser.update({
        where: { id: user.sub },
        data: { uiPreferences: next } as unknown as Prisma.PlatformUserUpdateInput,
      });
      return { uiTheme: theme ?? this.readUiTheme(next) };
    }

    if (!user.tenantId) throw new BadRequestException("Sessão sem tenant.");
    const tu = (await this.prisma.user.findFirst({
      where: { id: user.sub, tenantId: user.tenantId },
      select: { id: true, uiPreferences: true } as { id: true; uiPreferences: true },
    })) as { id: string; uiPreferences?: unknown } | null;
    if (!tu) throw new NotFoundException("Utilizador não encontrado.");
    const prev =
      tu.uiPreferences && typeof tu.uiPreferences === "object" && !Array.isArray(tu.uiPreferences)
        ? (tu.uiPreferences as Record<string, unknown>)
        : {};
    const next = { ...prev, ...(theme ? { uiTheme: theme } : {}) };
    await this.prisma.user.update({
      where: { id: tu.id },
      data: { uiPreferences: next } as unknown as Prisma.UserUpdateInput,
    });
    return { uiTheme: theme ?? this.readUiTheme(next) };
  }
}
