import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { generateSecret, generateURI, verify } from "otplib";
import QRCode from "qrcode";
import { isMfaAppCode, mfaAppDisplayLabel, type MfaAppCode } from "@nexiforma/shared";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/types/access-token-payload";
import { requireTenantId } from "../common/tenant-scope";

const MANAGER_ROLES = new Set(["ADMIN", "COORDENADOR", "FINANCEIRO"]);

@Injectable()
export class MfaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  requiresMfaForRole(_role: string, mfaEnabled: boolean): boolean {
    return mfaEnabled;
  }

  mustEnroll(user: { role: string; mfaEnabled: boolean; mfaRequired: boolean }): boolean {
    if (user.mfaRequired && !user.mfaEnabled) return true;
    return this.mustEnrollManager(user.role, user.mfaEnabled);
  }

  /** Bloqueia login de gestores sem MFA activo quando MFA_REQUIRED_MANAGERS=true. */
  mustEnrollManager(role: string, mfaEnabled: boolean): boolean {
    if (this.config.get<string>("MFA_REQUIRED_MANAGERS") !== "true") {
      return false;
    }
    return MANAGER_ROLES.has(role) && !mfaEnabled;
  }

  createPendingToken(userId: string): string {
    return this.jwt.sign(
      { sub: userId, type: "mfa_pending" },
      { expiresIn: 300 },
    );
  }

  createEnrollmentToken(userId: string): string {
    return this.jwt.sign(
      { sub: userId, type: "mfa_enrollment" },
      { expiresIn: 900 },
    );
  }

  async verifyPendingToken(token: string): Promise<string> {
    try {
      const payload = this.jwt.verify<{ sub: string; type?: string }>(token);
      if (payload.type !== "mfa_pending") {
        throw new BadRequestException("Token MFA inválido.");
      }
      return payload.sub;
    } catch {
      throw new BadRequestException("Token MFA inválido ou expirado.");
    }
  }

  async verifyEnrollmentToken(token: string): Promise<string> {
    try {
      const payload = this.jwt.verify<{ sub: string; type?: string }>(token);
      if (payload.type !== "mfa_enrollment") {
        throw new BadRequestException("Token de configuração MFA inválido.");
      }
      return payload.sub;
    } catch {
      throw new BadRequestException("Token de configuração MFA inválido ou expirado.");
    }
  }

  async setup(user: RequestUser) {
    const tenantId = requireTenantId(user);
    return this.setupForUser(user.sub, user.email, tenantId);
  }

  async setupForUser(userId: string, email: string, tenantId?: string) {
    const secret = generateSecret();
    await this.prisma.user.update({
      where: tenantId ? { id: userId, tenantId } : { id: userId },
      data: { mfaSecret: secret, mfaEnabled: false },
    });
    const otpauth = generateURI({
      issuer: "NexiForma",
      label: email,
      secret,
    });
    const qrDataUrl = await QRCode.toDataURL(otpauth, { width: 220, margin: 1 });
    return { otpauth, qrDataUrl };
  }

  async confirmSetup(user: RequestUser, code: string, mfaApp: MfaAppCode) {
    const tenantId = requireTenantId(user);
    return this.confirmSetupForUser(user.sub, tenantId, code, mfaApp);
  }

  async confirmSetupForUser(
    userId: string,
    tenantId: string | undefined,
    code: string,
    mfaApp: MfaAppCode,
  ) {
    if (!isMfaAppCode(mfaApp)) {
      throw new BadRequestException("App autenticadora inválida.");
    }
    const u = await this.prisma.user.findFirst({
      where: tenantId ? { id: userId, tenantId } : { id: userId },
    });
    if (!u?.mfaSecret) {
      throw new BadRequestException("MFA não iniciado.");
    }
    const result = await verify({ token: code, secret: u.mfaSecret });
    if (!result.valid) {
      throw new BadRequestException("Código inválido.");
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: true, mfaApp, mfaRequired: true },
    });
    return { enabled: true, mfaApp, mfaAppLabel: mfaAppDisplayLabel(mfaApp) };
  }

  async verifyCode(userId: string, code: string): Promise<boolean> {
    const u = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!u?.mfaSecret || !u.mfaEnabled) return false;
    const result = await verify({ token: code, secret: u.mfaSecret });
    return result.valid;
  }
}
