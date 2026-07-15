import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import type { Request, Response } from "express";
import type { TenantUserRole } from "@nexiforma/database";
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
import { resolvePasswordResetAppUrl } from "../common/app-public-url.util";

const PASSWORD_RESET_GENERIC =
  "Se existir uma conta com esse email, enviámos instruções para redefinir a palavra-passe.";

function mapPrismaRoleToJwt(role: TenantUserRole): JwtRole {
  switch (role) {
    case "ADMIN":
    case "COORDENADOR":
    case "FINANCEIRO":
      return "tenant_manager";
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
  ) {
    this.accessExpiresSeconds = parseJwtExpirySeconds(
      this.config.get<string>("JWT_EXPIRES") ?? "15m",
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

  private tenantLoginKey(dto: TenantLoginDto): string {
    return `${dto.tenantSlug.trim().toLowerCase()}:${dto.email.trim().toLowerCase()}`;
  }

  async loginTenant(
    dto: TenantLoginDto,
    res?: Response,
  ): Promise<LoginResponse> {
    const loginKey = this.tenantLoginKey(dto);
    await this.loginAttempts.assertNotLocked("tenant", loginKey);

    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: dto.tenantSlug },
    });
    if (!tenant) {
      await this.loginAttempts.recordFailure("tenant", loginKey);
      throw new UnauthorizedException("Tenant ou credenciais inválidas.");
    }
    if (tenant.status === "SUSPENDED" || tenant.status === "ARCHIVED") {
      await this.loginAttempts.recordFailure("tenant", loginKey);
      throw new UnauthorizedException("Conta da entidade formadora suspensa ou arquivada.");
    }

    const user = await this.prisma.user.findFirst({
      where: { tenantId: tenant.id, email: dto.email.toLowerCase(), active: true },
      include: { tenant: true },
    });
    if (!user?.passwordHash) {
      await this.loginAttempts.recordFailure("tenant", loginKey);
      throw new UnauthorizedException("Tenant ou credenciais inválidas.");
    }

    const ok = await argon2.verify(user.passwordHash, dto.password);
    if (!ok) {
      await this.loginAttempts.recordFailure("tenant", loginKey);
      throw new UnauthorizedException("Tenant ou credenciais inválidas.");
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
    const login = await this.completeLogin(payload, user.id, user.email, "tenant", res, dto.rememberMe === true);
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
    const ok = await this.mfa.verifyCode(userId, code);
    if (!ok) {
      throw new UnauthorizedException("Código MFA inválido.");
    }
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
    const login = this.completeLogin(payload, user.id, user.email, "tenant", res, rememberMe === true);
    return login.then((body) => ({
      ...body,
      ...(user.mustChangePassword ? { passwordChangeRequired: true } : {}),
    }));
  }

  async loginPlatform(
    dto: PlatformLoginDto,
    res?: Response,
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
    const ok = await argon2.verify(pu.passwordHash, dto.password);
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
    return this.completeLogin(payload, pu.id, pu.email, "platform", res, dto.rememberMe === true);
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
      const user = await this.prisma.user.findFirst({
        where: { id: row.subjectId, active: true },
        select: { mfaEnabled: true, mfaApp: true },
      });
      mfaRequired = Boolean(user?.mfaEnabled);
      if (mfaRequired) {
        mfaAppLabel = mfaAppDisplayLabel(user?.mfaApp);
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
    const slug = dto.tenantSlug.trim();
    const email = dto.email.toLowerCase();
    const tenant = await this.prisma.tenant.findUnique({ where: { slug } });
    if (!tenant) {
      return { message: PASSWORD_RESET_GENERIC };
    }

    const user = await this.prisma.user.findFirst({
      where: { tenantId: tenant.id, email, active: true },
    });
    if (!user) {
      return { message: PASSWORD_RESET_GENERIC };
    }

    await this.issuePasswordReset({
      subjectKind: "tenant",
      subjectId: user.id,
      email,
      tenantSlug: slug,
      appUrl: resolvePasswordResetAppUrl(this.config, req),
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
      appUrl: resolvePasswordResetAppUrl(this.config, req),
    });

    return { message: PASSWORD_RESET_GENERIC };
  }

  async confirmTenantPasswordReset(dto: TenantResetPasswordDto): Promise<{ message: string }> {
    const row = await this.findValidPasswordResetToken(dto.token);
    if (row.subjectKind !== "tenant") {
      throw new UnauthorizedException("Link inválido ou expirado.");
    }
    this.assertPasswordResetUserRef(row, dto.userRef, dto.tenantSlug);

    const user = await this.prisma.user.findFirst({
      where: { id: row.subjectId, active: true },
      select: { id: true, mfaEnabled: true, mfaApp: true },
    });
    if (!user) {
      throw new UnauthorizedException("Link inválido ou expirado.");
    }

    if (user.mfaEnabled) {
      const code = dto.mfaCode?.trim();
      if (!code || code.length !== 6) {
        throw new BadRequestException(
          `Código de 6 dígitos obrigatório (${mfaAppDisplayLabel(user.mfaApp)}).`,
        );
      }
      const ok = await this.mfa.verifyCode(user.id, code);
      if (!ok) {
        throw new UnauthorizedException(
          `Código inválido. Verifica ${mfaAppDisplayLabel(user.mfaApp)}.`,
        );
      }
    }

    const passwordHash = await argon2.hash(dto.newPassword, { type: argon2.argon2id });
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: row.subjectId },
        data: { passwordHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: row.id },
        data: { usedAt: new Date() },
      }),
    ]);

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

    return { message: "Palavra-passe actualizada. Podes iniciar sessão." };
  }

  private async issuePasswordReset(input: {
    subjectKind: "tenant" | "platform";
    subjectId: string;
    email: string;
    tenantSlug: string | null;
    appUrl: string;
  }) {
    const pepper = this.passwordResetPepper();
    const { raw, hash } = newPasswordResetOpaque(pepper);
    const ttlMin = this.passwordResetTtlMinutes();
    const expiresAt = new Date(Date.now() + ttlMin * 60_000);

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

    const tenantUser =
      input.subjectKind === "tenant"
        ? await this.prisma.user.findFirst({
            where: { id: input.subjectId },
            select: { mfaEnabled: true, mfaApp: true },
          })
        : null;

    await this.mail.sendPasswordReset(input.email, resetUrl, ttlMin, {
      mfaRequired: Boolean(tenantUser?.mfaEnabled),
      mfaAppLabel: tenantUser?.mfaEnabled
        ? mfaAppDisplayLabel(tenantUser.mfaApp)
        : undefined,
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
      return;
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

    /** Token de refresh já rotado/revogado reutilizado → possível roubo (MITM). */
    if (session?.revokedAt) {
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

    clearRefreshCookie(res, this.config);

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

  async endImpersonation(user: AccessTokenPayload, req: Request, res: Response): Promise<void> {
    if (user.impersonationSessionId) {
      await this.prisma.impersonationSession.updateMany({
        where: { id: user.impersonationSessionId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    await this.logoutFromCookie(req, res);
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

  /** Login com payload já montado (ex.: personificação super-admin). */
  completeLoginWithPayload(
    payload: AccessTokenPayload,
    res?: Response,
  ): Promise<LoginResponse> {
    return this.completeLogin(payload, payload.sub, payload.email, payload.kind, res);
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

    if (this.exposeRefreshInBody()) {
      body.refreshToken = opaque;
    }
    return body;
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
    await this.prisma.user.update({
      where: { id: row.id },
      data: { passwordHash, mustChangePassword: false },
    });
    return this.completeLoginForUser(
      { ...row, mustChangePassword: false },
      res,
    );
  }

  async meProfile(user: AccessTokenPayload): Promise<
    AccessTokenPayload & { displayName?: string | null }
  > {
    if (user.kind === "platform") {
      const pu = await this.prisma.platformUser.findUnique({
        where: { id: user.sub },
        select: { email: true, displayName: true },
      });
      return {
        ...user,
        email: pu?.email ?? user.email,
        displayName: pu?.displayName ?? null,
      };
    }

    const tenantUser = user.tenantId
      ? await this.prisma.user.findFirst({
          where: { id: user.sub, tenantId: user.tenantId },
          select: { email: true, displayName: true },
        })
      : null;

    return {
      ...user,
      email: tenantUser?.email ?? user.email,
      displayName: tenantUser?.displayName ?? null,
    };
  }
}
