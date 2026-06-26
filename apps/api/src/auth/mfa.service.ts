import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { generateSecret, generateURI, verify } from "otplib";
import QRCode from "qrcode";
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

  async setup(user: RequestUser) {
    const tenantId = requireTenantId(user);
    const secret = generateSecret();
    await this.prisma.user.update({
      where: { id: user.sub, tenantId },
      data: { mfaSecret: secret, mfaEnabled: false },
    });
    const otpauth = generateURI({
      issuer: "NexiForma",
      label: user.email,
      secret,
    });
    const qrDataUrl = await QRCode.toDataURL(otpauth, { width: 220, margin: 1 });
    return { otpauth, secret, qrDataUrl };
  }

  async confirmSetup(user: RequestUser, code: string) {
    const tenantId = requireTenantId(user);
    const u = await this.prisma.user.findFirst({ where: { id: user.sub, tenantId } });
    if (!u?.mfaSecret) {
      throw new BadRequestException("MFA não iniciado.");
    }
    const result = await verify({ token: code, secret: u.mfaSecret });
    if (!result.valid) {
      throw new BadRequestException("Código inválido.");
    }
    await this.prisma.user.update({
      where: { id: user.sub },
      data: { mfaEnabled: true },
    });
    return { enabled: true };
  }

  async verifyCode(userId: string, code: string): Promise<boolean> {
    const u = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!u?.mfaSecret || !u.mfaEnabled) return false;
    const result = await verify({ token: code, secret: u.mfaSecret });
    return result.valid;
  }
}
