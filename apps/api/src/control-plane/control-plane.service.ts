import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash, randomBytes } from "crypto";
import * as argon2 from "argon2";
import type { ControlTenantStatus } from "@nexiforma/database";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/types/access-token-payload";
import { AuditService } from "../audit/audit.service";
import { PlatformTenantNotificacoesService } from "../notificacoes/platform-tenant-notificacoes.service";
import type {
  CreateSubscriptionKeyDto,
  CreateTenantDto,
  UpdateTenantDto,
} from "./dto/control-plane.dto";

@Injectable()
export class ControlPlaneService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
    private readonly tenantNotificacoes: PlatformTenantNotificacoesService,
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
    return this.updateTenant(actor, id, { status }, actorIp);
  }

  async createTenant(
    actor: RequestUser,
    dto: CreateTenantDto,
    actorIp?: string,
  ): Promise<Record<string, unknown>> {
    const slug = dto.slug.trim().toLowerCase();
    const nif = dto.nif.trim();
    const planCode = dto.planCode ?? "starter";

    const [slugClash, nifClash, plan] = await Promise.all([
      this.prisma.tenant.findUnique({ where: { slug } }),
      this.prisma.tenant.findUnique({ where: { nif } }),
      this.prisma.subscriptionPlan.findFirst({ where: { code: planCode, active: true } }),
    ]);
    if (slugClash) {
      throw new ConflictException("Slug de tenant já existe.");
    }
    if (nifClash) {
      throw new ConflictException("NIF já registado noutro tenant.");
    }
    if (!plan) {
      throw new BadRequestException(`Plano «${planCode}» não encontrado ou inactivo.`);
    }

    if (dto.managerEmail && !dto.managerPassword) {
      throw new BadRequestException("Password do gestor inicial é obrigatória com email.");
    }

    const managerEmail = dto.managerEmail?.trim().toLowerCase();
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    const tenant = await this.prisma.$transaction(async (tx) => {
      const row = await tx.tenant.create({
        data: {
          slug,
          legalName: dto.legalName.trim(),
          nif,
          status: dto.status ?? "TRIAL",
        },
      });

      await tx.tenantSubscription.create({
        data: {
          tenantId: row.id,
          planId: plan.id,
          status: "TRIALING",
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          billingEmail: dto.billingEmail?.trim() || managerEmail || null,
        },
      });

      if (managerEmail && dto.managerPassword) {
        await tx.user.create({
          data: {
            tenantId: row.id,
            email: managerEmail,
            passwordHash: await argon2.hash(dto.managerPassword),
            displayName: dto.managerDisplayName?.trim() || "Gestor",
            role: "ADMIN",
            active: true,
          },
        });
      }

      return row;
    });

    await this.audit.log({
      actorType: "SUPERADMIN_USER",
      actorId: actor.sub,
      actorIp,
      action: "tenant.create",
      resourceType: "tenant",
      resourceId: tenant.id,
      targetTenantId: tenant.id,
      payload: { slug, planCode, managerEmail: managerEmail ?? null },
    });

    void this.tenantNotificacoes
      .notificarSuperadminsTenantLifecycle({
        acao: "criado",
        tenant: {
          id: tenant.id,
          slug: tenant.slug,
          legalName: tenant.legalName,
          nif: tenant.nif,
          status: tenant.status,
        },
        actorEmail: actor.email,
        detalhe: `Plano: ${plan.name} (${planCode})${managerEmail ? `\nGestor inicial: ${managerEmail}` : ""}`,
      })
      .catch(() => undefined);

    if (managerEmail) {
      void this.tenantNotificacoes
        .enviarBoasVindasGestor({
          email: managerEmail,
          displayName: dto.managerDisplayName?.trim() || "Gestor",
          entidadeFormadora: tenant.legalName,
          slug: tenant.slug,
        })
        .catch(() => undefined);
    }

    return this.getTenant(tenant.id);
  }

  async updateTenant(
    actor: RequestUser,
    id: string,
    dto: UpdateTenantDto,
    actorIp?: string,
  ): Promise<Record<string, unknown>> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) {
      throw new NotFoundException("Tenant não encontrado.");
    }

    const slug = dto.slug?.trim().toLowerCase();
    const nif = dto.nif?.trim();

    if (slug && slug !== tenant.slug) {
      const clash = await this.prisma.tenant.findUnique({ where: { slug } });
      if (clash) {
        throw new ConflictException("Slug de tenant já existe.");
      }
    }
    if (nif && nif !== tenant.nif) {
      const clash = await this.prisma.tenant.findUnique({ where: { nif } });
      if (clash) {
        throw new ConflictException("NIF já registado noutro tenant.");
      }
    }

    const updated = await this.prisma.tenant.update({
      where: { id },
      data: {
        ...(slug ? { slug } : {}),
        ...(dto.legalName !== undefined ? { legalName: dto.legalName.trim() } : {}),
        ...(nif ? { nif } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.metadata !== undefined ? { metadata: dto.metadata as object } : {}),
      },
    });

    await this.audit.log({
      actorType: "SUPERADMIN_USER",
      actorId: actor.sub,
      actorIp,
      action: dto.status !== undefined && Object.keys(dto).length === 1 ? "tenant.status_update" : "tenant.update",
      resourceType: "tenant",
      resourceId: id,
      targetTenantId: id,
      payload: {
        from: { slug: tenant.slug, status: tenant.status },
        to: { slug: updated.slug, status: updated.status },
      },
    });

    const alteracoes: string[] = [];
    if (slug && slug !== tenant.slug) alteracoes.push(`Slug: ${tenant.slug} → ${slug}`);
    if (dto.legalName !== undefined && dto.legalName.trim() !== tenant.legalName) {
      alteracoes.push(`Entidade: ${tenant.legalName} → ${dto.legalName.trim()}`);
    }
    if (nif && nif !== tenant.nif) alteracoes.push(`NIF: ${tenant.nif} → ${nif}`);
    if (dto.status !== undefined && dto.status !== tenant.status) {
      alteracoes.push(`Estado: ${tenant.status} → ${dto.status}`);
    }
    if (dto.metadata !== undefined) alteracoes.push("Metadata actualizado");

    void this.tenantNotificacoes
      .notificarSuperadminsTenantLifecycle({
        acao: "actualizado",
        tenant: {
          id: updated.id,
          slug: updated.slug,
          legalName: updated.legalName,
          nif: updated.nif,
          status: updated.status,
        },
        actorEmail: actor.email,
        detalhe: alteracoes.length ? alteracoes.join("\n") : "Dados actualizados",
      })
      .catch(() => undefined);

    return updated;
  }

  async deleteTenant(
    actor: RequestUser,
    id: string,
    opts?: { permanent?: boolean },
    actorIp?: string,
  ): Promise<{ ok: true; mode: "archived" | "deleted" }> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
            acoesFormacao: true,
            formandos: true,
            cursos: true,
          },
        },
      },
    });
    if (!tenant) {
      throw new NotFoundException("Tenant não encontrado.");
    }

    if (opts?.permanent) {
      const hasData =
        tenant._count.users > 0 ||
        tenant._count.acoesFormacao > 0 ||
        tenant._count.formandos > 0 ||
        tenant._count.cursos > 0;
      if (hasData) {
        throw new BadRequestException(
          "Tenant com dados operacionais - arquive primeiro ou remova dados antes de eliminar permanentemente.",
        );
      }
      await this.prisma.tenant.delete({ where: { id } });
      await this.audit.log({
        actorType: "SUPERADMIN_USER",
        actorId: actor.sub,
        actorIp,
        action: "tenant.delete_permanent",
        resourceType: "tenant",
        resourceId: id,
        targetTenantId: id,
        payload: { slug: tenant.slug },
      });

      void this.tenantNotificacoes
        .notificarSuperadminsTenantLifecycle({
          acao: "eliminado",
          tenant: {
            id: tenant.id,
            slug: tenant.slug,
            legalName: tenant.legalName,
            nif: tenant.nif,
            status: tenant.status,
          },
          actorEmail: actor.email,
        })
        .catch(() => undefined);

      return { ok: true, mode: "deleted" };
    }

    if (tenant.status === "ARCHIVED") {
      return { ok: true, mode: "archived" };
    }

    await this.prisma.tenant.update({
      where: { id },
      data: { status: "ARCHIVED" },
    });

    await this.audit.log({
      actorType: "SUPERADMIN_USER",
      actorId: actor.sub,
      actorIp,
      action: "tenant.archive",
      resourceType: "tenant",
      resourceId: id,
      targetTenantId: id,
      payload: { slug: tenant.slug },
    });

    void this.tenantNotificacoes
      .notificarSuperadminsTenantLifecycle({
        acao: "arquivado",
        tenant: {
          id: tenant.id,
          slug: tenant.slug,
          legalName: tenant.legalName,
          nif: tenant.nif,
          status: "ARCHIVED",
        },
        actorEmail: actor.email,
      })
      .catch(() => undefined);

    return { ok: true, mode: "archived" };
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
