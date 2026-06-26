import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash, randomBytes } from "crypto";
import type { ControlTenantStatus } from "@nexiforma/database";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/types/access-token-payload";
import { AuditService } from "../audit/audit.service";
import type { CreateSubscriptionKeyDto } from "./dto/control-plane.dto";

@Injectable()
export class ControlPlaneService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  listTenants() {
    return this.prisma.tenant.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        slug: true,
        legalName: true,
        nif: true,
        status: true,
        createdAt: true,
        _count: {
          select: {
            users: true,
            acoesFormacao: true,
            matriculas: true,
          },
        },
        subscriptions: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            status: true,
            currentPeriodEnd: true,
            plan: { select: { code: true, name: true } },
          },
        },
      },
    });
  }

  async getTenant(id: string): Promise<Record<string, unknown>> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      select: {
        id: true,
        slug: true,
        legalName: true,
        nif: true,
        status: true,
        metadata: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            users: true,
            acoesFormacao: true,
            formandos: true,
            sessoesFormacao: true,
          },
        },
        subscriptions: {
          orderBy: { createdAt: "desc" },
          take: 3,
          include: { plan: true },
        },
        subscriptionKeys: {
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            id: true,
            keyPrefix: true,
            status: true,
            expiresAt: true,
            createdAt: true,
            rotatedAt: true,
            revokedAt: true,
          },
        },
      },
    });
    if (!tenant) {
      throw new NotFoundException("Tenant não encontrado.");
    }
    return tenant;
  }

  async listTenantUsers(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException("Tenant não encontrado.");
    }
    return this.prisma.user.findMany({
      where: { tenantId, active: true },
      orderBy: [{ role: "asc" }, { email: "asc" }],
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
      },
    });
  }

  async updateTenantStatus(
    actor: RequestUser,
    id: string,
    status: ControlTenantStatus,
    actorIp?: string,
  ): Promise<Record<string, unknown>> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) {
      throw new NotFoundException("Tenant não encontrado.");
    }

    const updated = await this.prisma.tenant.update({
      where: { id },
      data: { status },
    });

    await this.audit.log({
      actorType: "SUPERADMIN_USER",
      actorId: actor.sub,
      actorIp,
      action: "tenant.status_update",
      resourceType: "tenant",
      resourceId: id,
      targetTenantId: id,
      payload: { from: tenant.status, to: status },
    });

    return updated;
  }

  async platformMetrics() {
    const [tenants, users, acoes, subs, audit24h] = await Promise.all([
      this.prisma.tenant.groupBy({ by: ["status"], _count: true }),
      this.prisma.user.count(),
      this.prisma.acaoFormacao.count(),
      this.prisma.tenantSubscription.groupBy({ by: ["status"], _count: true }),
      this.prisma.globalAuditLog.count({
        where: { occurredAt: { gte: new Date(Date.now() - 86_400_000) } },
      }),
    ]);

    return {
      tenantsByStatus: tenants,
      totalUsers: users,
      totalAcoes: acoes,
      subscriptionsByStatus: subs,
      auditEvents24h: audit24h,
    };
  }

  listAuditLogs(tenantId?: string, limit?: number): Promise<Record<string, unknown>[]> {
    return this.audit.list({ tenantId, limit });
  }

  async createSubscriptionKey(
    actor: RequestUser,
    tenantId: string,
    dto: CreateSubscriptionKeyDto,
    actorIp?: string,
  ) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException("Tenant não encontrado.");
    }

    const active = await this.prisma.tenantSubscriptionKey.findFirst({
      where: { tenantId, status: "ACTIVE" },
    });
    if (active) {
      throw new BadRequestException(
        "Já existe chave activa – revoga ou roda antes de criar nova.",
      );
    }

    const prefix = "nf_live_";
    const secret = randomBytes(24).toString("base64url");
    const pepper = this.config.get<string>("SUBSCRIPTION_KEY_PEPPER") ?? "";
    const keyHash = createHash("sha256")
      .update(`${prefix}${secret}${pepper}`)
      .digest("hex");

    const expiresAt = dto.expiresInDays
      ? new Date(Date.now() + dto.expiresInDays * 86_400_000)
      : null;

    const row = await this.prisma.tenantSubscriptionKey.create({
      data: {
        tenantId,
        keyPrefix: prefix,
        keyHash,
        maxActiveUsersSnapshot: dto.maxActiveUsersSnapshot ?? null,
        expiresAt,
      },
    });

    await this.audit.log({
      actorType: "SUPERADMIN_USER",
      actorId: actor.sub,
      actorIp,
      action: "subscription_key.create",
      resourceType: "tenant_subscription_key",
      resourceId: row.id,
      targetTenantId: tenantId,
    });

    return {
      id: row.id,
      key: `${prefix}${secret}`,
      expiresAt: row.expiresAt,
      warning: "Guarde a chave – não será mostrada novamente.",
    };
  }

  async revokeSubscriptionKey(
    actor: RequestUser,
    tenantId: string,
    keyId: string,
    actorIp?: string,
  ) {
    const key = await this.prisma.tenantSubscriptionKey.findFirst({
      where: { id: keyId, tenantId },
    });
    if (!key) {
      throw new NotFoundException("Chave não encontrada.");
    }

    const updated = await this.prisma.tenantSubscriptionKey.update({
      where: { id: keyId },
      data: { status: "REVOKED", revokedAt: new Date() },
    });

    await this.audit.log({
      actorType: "SUPERADMIN_USER",
      actorId: actor.sub,
      actorIp,
      action: "subscription_key.revoke",
      resourceType: "tenant_subscription_key",
      resourceId: keyId,
      targetTenantId: tenantId,
    });

    return updated;
  }
}
