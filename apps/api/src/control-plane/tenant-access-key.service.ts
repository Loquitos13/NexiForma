import { createHash, randomBytes } from "crypto";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Response } from "express";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import type { LoginResponse } from "../auth/auth.service";
import { ImpersonationService } from "./impersonation.service";
import type { RequestUser } from "../auth/types/access-token-payload";

const DEFAULT_TTL_HOURS = 10;

@Injectable()
export class TenantAccessKeyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
    private readonly impersonation: ImpersonationService,
  ) {}

  private hashKey(raw: string): string {
    const pepper = this.config.get<string>("TENANT_ACCESS_KEY_PEPPER") ?? "";
    return createHash("sha256").update(`${raw}${pepper}`).digest("hex");
  }

  private ttlMs(): number {
    const hours = Number(this.config.get<string>("TENANT_ACCESS_KEY_TTL_HOURS") ?? DEFAULT_TTL_HOURS);
    const safe = Number.isFinite(hours) && hours > 0 ? hours : DEFAULT_TTL_HOURS;
    return safe * 3_600_000;
  }

  /** Marca ACTIVE com expires_at ultrapassado como EXPIRED na BD. */
  private async syncExpiredKeys(tenantId?: string): Promise<void> {
    const now = new Date();
    await this.prisma.tenantAccessKey.updateMany({
      where: {
        status: "ACTIVE",
        expiresAt: { lt: now },
        ...(tenantId ? { tenantId } : {}),
      },
      data: { status: "EXPIRED" },
    });
  }

  async listKeys(tenantId: string) {
    await this.syncExpiredKeys(tenantId);
    const rows = await this.prisma.tenantAccessKey.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        keyPrefix: true,
        label: true,
        status: true,
        expiresAt: true,
        createdAt: true,
        revokedAt: true,
        lastUsedAt: true,
      },
    });
    return rows;
  }

  async createKey(
    actor: RequestUser,
    tenantId: string,
    opts?: { label?: string },
    actorIp?: string,
  ) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException("Tenant não encontrado.");

    const prefix = "nf_access_";
    const secret = randomBytes(24).toString("base64url");
    const raw = `${prefix}${secret}`;
    const keyHash = this.hashKey(raw);
    const expiresAt = new Date(Date.now() + this.ttlMs());

    const row = await this.prisma.tenantAccessKey.create({
      data: {
        tenantId,
        keyPrefix: prefix,
        keyHash,
        label: opts?.label?.trim() || "Chave de acesso suporte",
        expiresAt,
        createdById: actor.sub,
      },
    });

    await this.audit.log({
      actorType: "SUPERADMIN_USER",
      actorId: actor.sub,
      actorIp,
      action: "tenant_access_key.create",
      resourceType: "tenant_access_key",
      resourceId: row.id,
      targetTenantId: tenantId,
    });

    return {
      id: row.id,
      key: raw,
      expiresAt,
      label: row.label,
      ttlHours: this.ttlMs() / 3_600_000,
    };
  }

  async revokeKey(actor: RequestUser, tenantId: string, keyId: string, actorIp?: string) {
    await this.syncExpiredKeys(tenantId);

    const row = await this.prisma.tenantAccessKey.findFirst({
      where: { id: keyId, tenantId },
    });
    if (!row) throw new NotFoundException("Chave não encontrada.");
    if (row.status === "REVOKED") {
      throw new BadRequestException("Chave já revogada.");
    }
    if (row.status === "EXPIRED") {
      throw new BadRequestException("Chave já expirada.");
    }

    await this.prisma.tenantAccessKey.update({
      where: { id: keyId },
      data: { status: "REVOKED", revokedAt: new Date() },
    });

    await this.audit.log({
      actorType: "SUPERADMIN_USER",
      actorId: actor.sub,
      actorIp,
      action: "tenant_access_key.revoke",
      resourceType: "tenant_access_key",
      resourceId: keyId,
      targetTenantId: tenantId,
    });

    return { ok: true, status: "REVOKED" as const };
  }

  async redeemKey(
    actor: RequestUser,
    rawKey: string,
    res?: Response,
    actorIp?: string,
  ): Promise<LoginResponse & { impersonationSessionId: string }> {
    if (!rawKey.startsWith("nf_access_")) {
      throw new UnauthorizedException("Chave inválida.");
    }

    const keyHash = this.hashKey(rawKey);
    await this.syncExpiredKeys();

    const row = await this.prisma.tenantAccessKey.findFirst({
      where: { keyHash },
      include: { tenant: true },
    });
    if (!row) throw new UnauthorizedException("Chave inválida.");
    if (row.status === "REVOKED") {
      throw new UnauthorizedException("Chave revogada.");
    }
    if (row.status === "EXPIRED" || (row.expiresAt && row.expiresAt < new Date())) {
      if (row.status === "ACTIVE") {
        await this.prisma.tenantAccessKey.update({
          where: { id: row.id },
          data: { status: "EXPIRED" },
        });
      }
      throw new UnauthorizedException("Chave expirada.");
    }

    const admin = await this.prisma.user.findFirst({
      where: { tenantId: row.tenantId, role: "ADMIN", active: true },
      orderBy: { createdAt: "asc" },
    });
    if (!admin) {
      throw new NotFoundException("Tenant sem gestor ADMIN activo.");
    }

    await this.prisma.tenantAccessKey.update({
      where: { id: row.id },
      data: { lastUsedAt: new Date() },
    });

    return this.impersonation.startImpersonation(
      actor,
      row.tenantId,
      {
        targetUserId: admin.id,
        reason: `Acesso via chave partilhada (${row.label ?? row.id})`,
        readOnly: false,
      },
      res,
      actorIp,
    );
  }
}
