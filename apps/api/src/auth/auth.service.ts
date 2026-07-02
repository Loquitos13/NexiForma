import {
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import type { Request, Response } from "express";
import type { TenantUserRole } from "@nexiforma/database";
import type { JwtKind, JwtRole } from "@nexiforma/shared";
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
  TenantForgotPasswordDto,
  TenantResetPasswordDto,
} from "./dto/forgot-password.dto";
import { MfaService } from "./mfa.service";
import { hashRefreshToken, newRefreshOpaqueToken } from "./refresh-token.util";
import type { AccessTokenPayload } from "./types/access-token-payload";
import { MailService } from "../mail/mail.service";
import {
  hashPasswordResetToken,
  newPasswordResetOpaque,
} from "./password-reset.util";

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
  mfaToken?: string;
  user: {
    id: string;
    email: string;
    role: JwtRole;
    kind: JwtKind;
    tenantId?: string | null;
    tenantSlug?: string | null;
  };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly accessExpiresSeconds: number;
  private readonly refreshExpiresSeconds: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mfa: MfaService,
    private readonly mail: MailService,
  ) {
    this.accessExpiresSeconds = parseJwtExpirySeconds(
      this.config.get<string>("JWT_EXPIRES") ?? "15m",
    );
    this.refreshExpiresSeconds = parseJwtExpirySeconds(
      this.config.get<string>("JWT_REFRESH_EXPIRES") ?? "7d",
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

  async loginTenant(
    dto: TenantLoginDto,
    res?: Response,
  ): Promise<LoginResponse> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: dto.tenantSlug },
    });
    if (!tenant) {
      throw new UnauthorizedException("Tenant ou credenciais inválidas.");
    }
    if (tenant.status === "SUSPENDED" || tenant.status === "ARCHIVED") {
      throw new UnauthorizedException("Conta da entidade formadora suspensa ou arquivada.");
    }

    const user = await this.prisma.user.findFirst({
      where: { tenantId: tenant.id, email: dto.email.toLowerCase(), active: true },
      include: { tenant: true },
    });
    if (!user?.passwordHash) {
      throw new UnauthorizedException("Tenant ou credenciais inválidas.");
    }

    const ok = await argon2.verify(user.passwordHash, dto.password);
    if (!ok) {
      throw new UnauthorizedException("Tenant ou credenciais inválidas.");
    }

    const role = mapPrismaRoleToJwt(user.role);

    if (this.mfa.mustEnrollManager(user.role, user.mfaEnabled)) {
      throw new UnauthorizedException(
        "MFA obrigatório para gestores. Activa em Definições ou contacta o administrador.",
      );
    }

    if (this.mfa.requiresMfaForRole(user.role, user.mfaEnabled)) {
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
    };
    return this.completeLogin(payload, user.id, user.email, "tenant", res);
  }

  async verifyMfaLogin(mfaToken: string, code: string, res?: Response): Promise<LoginResponse> {
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
    return this.completeLoginForUser(user, res);
  }

  completeLoginForUser(
    user: {
      id: string;
      email: string;
      role: TenantUserRole;
      tenantId: string;
      tenant: { slug: string };
    },
    res?: Response,
  ): Promise<LoginResponse> {
    const payload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      kind: "tenant",
      role: mapPrismaRoleToJwt(user.role),
      tenantId: user.tenantId,
      tenantSlug: user.tenant.slug,
    };
    return this.completeLogin(payload, user.id, user.email, "tenant", res);
  }

  async loginPlatform(
    dto: PlatformLoginDto,
    res?: Response,
  ): Promise<LoginResponse> {
    const pu = await this.prisma.platformUser.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (!pu?.active) {
      throw new UnauthorizedException("Credenciais inválidas.");
    }
    const ok = await argon2.verify(pu.passwordHash, dto.password);
    if (!ok) {
      throw new UnauthorizedException("Credenciais inválidas.");
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

  private passwordResetPepper(): string {
    return (
      this.config.get<string>("PASSWORD_RESET_PEPPER") ??
      `${this.config.getOrThrow<string>("JWT_SECRET")}:password_reset`
    );
  }

  private passwordResetTtlMinutes(): number {
    return Number(this.config.get<string>("PASSWORD_RESET_TTL_MINUTES") ?? 60);
  }

  async requestTenantPasswordReset(dto: TenantForgotPasswordDto): Promise<{ message: string }> {
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
    });

    return { message: PASSWORD_RESET_GENERIC };
  }

  async requestPlatformPasswordReset(dto: PlatformForgotPasswordDto): Promise<{ message: string }> {
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
    });

    return { message: PASSWORD_RESET_GENERIC };
  }

  async confirmTenantPasswordReset(dto: TenantResetPasswordDto): Promise<{ message: string }> {
    const row = await this.consumePasswordResetToken(dto.token);
    if (row.subjectKind !== "tenant") {
      throw new UnauthorizedException("Link inválido ou expirado.");
    }
    if (dto.tenantSlug?.trim() && row.tenantSlug !== dto.tenantSlug.trim()) {
      throw new UnauthorizedException("Link inválido ou expirado.");
    }

    const passwordHash = await argon2.hash(dto.newPassword, { type: argon2.argon2id });
    await this.prisma.user.update({
      where: { id: row.subjectId },
      data: { passwordHash },
    });

    return { message: "Palavra-passe actualizada. Podes iniciar sessão." };
  }

  async confirmPlatformPasswordReset(dto: PlatformResetPasswordDto): Promise<{ message: string }> {
    const row = await this.consumePasswordResetToken(dto.token);
    if (row.subjectKind !== "platform") {
      throw new UnauthorizedException("Link inválido ou expirado.");
    }

    const passwordHash = await argon2.hash(dto.newPassword, { type: argon2.argon2id });
    await this.prisma.platformUser.update({
      where: { id: row.subjectId },
      data: { passwordHash },
    });

    return { message: "Palavra-passe actualizada. Podes iniciar sessão." };
  }

  private async issuePasswordReset(input: {
    subjectKind: "tenant" | "platform";
    subjectId: string;
    email: string;
    tenantSlug: string | null;
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

    const appUrl = this.config.get<string>("APP_PUBLIC_URL") ?? "http://localhost:3000";
    const qs = new URLSearchParams({ token: raw });
    if (input.tenantSlug) qs.set("slug", input.tenantSlug);
    const resetUrl = `${appUrl}/login/recuperar?${qs.toString()}`;

    await this.mail.sendPasswordReset(input.email, resetUrl, ttlMin);

    if (this.config.get<string>("NODE_ENV") !== "production") {
      this.logger.log(`[dev] password reset link: ${resetUrl}`);
    }
  }

  private async consumePasswordResetToken(rawToken: string) {
    const pepper = this.passwordResetPepper();
    const tokenHash = hashPasswordResetToken(pepper, rawToken);
    const row = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });
    if (!row || row.usedAt || row.expiresAt <= new Date()) {
      throw new UnauthorizedException("Link inválido ou expirado.");
    }

    await this.prisma.passwordResetToken.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    });

    return row;
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
    if (!session || session.revokedAt || session.expiresAt <= now) {
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

  private async completeLogin(
    payload: AccessTokenPayload,
    userIdForResponse: string,
    emailForResponse: string,
    subjectKind: "tenant" | "platform",
    res?: Response,
  ): Promise<LoginResponse> {
    const accessToken = this.signAccessToken(payload);
    const opaque = newRefreshOpaqueToken();
    const tokenHash = hashRefreshToken(this.refreshPepper(), opaque);

    await this.prisma.authRefreshSession.create({
      data: {
        tokenHash,
        subjectKind,
        subjectId: payload.sub,
        expiresAt: new Date(Date.now() + this.refreshExpiresSeconds * 1000),
      },
    });

    if (res) {
      attachRefreshCookie(res, this.config, opaque, this.refreshExpiresSeconds);
    }

    const body: LoginResponse = {
      accessToken,
      tokenType: "Bearer",
      expiresIn: this.accessExpiresSeconds,
      refreshExpiresIn: this.refreshExpiresSeconds,
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
}
