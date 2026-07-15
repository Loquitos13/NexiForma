import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash, randomBytes } from "crypto";
import * as argon2 from "argon2";
import type { ControlTenantStatus } from "@nexiforma/database";
import {
  assertValidTenantSubscription,
  TenantSubscriptionValidationError,
  type BillingPlanCode,
} from "@nexiforma/shared";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/types/access-token-payload";
import { AuditService } from "../audit/audit.service";
import { PlatformTenantNotificacoesService } from "../notificacoes/platform-tenant-notificacoes.service";
import {
  hashInviteToken,
  invitePepperFromConfig,
  newInviteOpaqueToken,
} from "../common/invite-token.util";
import { resolveAppPublicUrl } from "../common/app-public-url.util";
import type {
  CreateSubscriptionKeyDto,
  CreateTenantDto,
  InviteManagerDto,
  UpdateTenantDto,
  UpdateTenantSubscriptionDto,
  UpdatePlatformMeDto,
} from "./dto/control-plane.dto";

@Injectable()
export class ControlPlaneService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
    private readonly tenantNotificacoes: PlatformTenantNotificacoesService,
  ) {}

  private invitePepper(): string {
    return invitePepperFromConfig(
      (k) => this.config.get<string>(k),
      (k) => this.config.getOrThrow<string>(k),
    );
  }

  private async createManagerInvite(
    tenantId: string,
    email: string,
    displayName: string,
    invitedById: string,
    appUrl: string,
  ): Promise<{ inviteUrl: string; expiresAt: Date }> {
    const normalized = email.toLowerCase().trim();
    const existing = await this.prisma.user.findFirst({
      where: { tenantId, email: normalized },
    });
    if (existing) {
      throw new ConflictException("Já existe utilizador gestor com este email neste tenant.");
    }

    const rawToken = newInviteOpaqueToken();
    const tokenHash = hashInviteToken(this.invitePepper(), rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.prisma.tenantInvite.upsert({
      where: { tenantId_email: { tenantId, email: normalized } },
      create: {
        tenantId,
        email: normalized,
        displayName: displayName.trim() || "Gestor",
        role: "ADMIN",
        tokenHash,
        expiresAt,
        invitedById,
      },
      update: {
        displayName: displayName.trim() || "Gestor",
        role: "ADMIN",
        tokenHash,
        expiresAt,
        acceptedAt: null,
        invitedById,
      },
    });

    const inviteUrl = `${appUrl.replace(/\/$/, "")}/convite/${rawToken}`;
    return { inviteUrl, expiresAt };
  }

  listTenants(): Promise<Record<string, unknown>[]> {
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
            customAddons: true,
            plan: { select: { code: true, name: true } },
          },
        },
      },
    });
  }

  listSubscriptionPlans(): Promise<Record<string, unknown>[]> {
    return this.prisma.subscriptionPlan.findMany({
      where: { active: true },
      orderBy: { priceCentsMonthly: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
        priceCentsMonthly: true,
        maxActiveUsers: true,
        features: true,
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
    req?: { headers: Record<string, string | string[] | undefined> },
  ): Promise<Record<string, unknown>> {
    const slug = dto.slug.trim().toLowerCase();
    const nif = dto.nif.trim();
    const planCode = (dto.planCode ?? "starter") as BillingPlanCode;

    let customAddons: string[];
    try {
      customAddons = assertValidTenantSubscription(planCode, dto.customAddons ?? []);
    } catch (e) {
      if (e instanceof TenantSubscriptionValidationError) {
        throw new BadRequestException(e.message);
      }
      throw e;
    }

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

    if (dto.managerEmail && dto.managerPassword && dto.managerPassword.length < 8) {
      throw new BadRequestException("Password do gestor: mínimo 8 caracteres.");
    }

    const managerEmail = dto.managerEmail?.trim().toLowerCase();
    const managerDisplayName = dto.managerDisplayName?.trim() || "Gestor";
    const sendManagerInvite = Boolean(managerEmail && !dto.managerPassword);
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
          customAddons,
        },
      });

      if (managerEmail && dto.managerPassword) {
        await tx.user.create({
          data: {
            tenantId: row.id,
            email: managerEmail,
            passwordHash: await argon2.hash(dto.managerPassword),
            displayName: managerDisplayName,
            role: "ADMIN",
            active: true,
          },
        });
      }

      if (sendManagerInvite) {
        const rawToken = newInviteOpaqueToken();
        const tokenHash = hashInviteToken(this.invitePepper(), rawToken);
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        await tx.tenantInvite.create({
          data: {
            tenantId: row.id,
            email: managerEmail!,
            displayName: managerDisplayName,
            role: "ADMIN",
            tokenHash,
            expiresAt,
            invitedById: actor.sub,
          },
        });
        return { row, managerInviteToken: rawToken };
      }

      return { row, managerInviteToken: undefined as string | undefined };
    });

    const managerInviteToken = tenant.managerInviteToken;
    const tenantRow = tenant.row;

    await this.audit.log({
      actorType: "SUPERADMIN_USER",
      actorId: actor.sub,
      actorIp,
      action: "tenant.create",
      resourceType: "tenant",
      resourceId: tenantRow.id,
      targetTenantId: tenantRow.id,
      payload: {
        slug,
        planCode,
        customAddons,
        managerEmail: managerEmail ?? null,
        managerInvite: sendManagerInvite,
      },
    });

    void this.tenantNotificacoes
      .notificarSuperadminsTenantLifecycle({
        acao: "criado",
        tenant: {
          id: tenantRow.id,
          slug: tenantRow.slug,
          legalName: tenantRow.legalName,
          nif: tenantRow.nif,
          status: tenantRow.status,
        },
        actorEmail: actor.email,
        detalhe: `Plano: ${plan.name} (${planCode})${customAddons.length ? `\nMódulos: ${customAddons.join(", ")}` : ""}${managerEmail ? `\nGestor inicial: ${managerEmail}${sendManagerInvite ? " (convite)" : ""}` : ""}`,
      })
      .catch(() => undefined);

    if (managerEmail && dto.managerPassword) {
      void this.tenantNotificacoes
        .enviarBoasVindasGestor({
          email: managerEmail,
          displayName: managerDisplayName,
          entidadeFormadora: tenantRow.legalName,
          slug: tenantRow.slug,
        })
        .catch(() => undefined);
    } else if (managerEmail && managerInviteToken) {
      const appUrl = resolveAppPublicUrl(this.config, req);
      const inviteUrl = `${appUrl.replace(/\/$/, "")}/convite/${managerInviteToken}`;
      void this.tenantNotificacoes
        .enviarConviteGestor({
          email: managerEmail,
          displayName: managerDisplayName,
          entidadeFormadora: tenantRow.legalName,
          slug: tenantRow.slug,
          inviteUrl,
        })
        .catch(() => undefined);
    }

    return this.getTenant(tenantRow.id);
  }

  async inviteTenantManager(
    actor: RequestUser,
    tenantId: string,
    dto: InviteManagerDto,
    actorIp?: string,
    req?: { headers: Record<string, string | string[] | undefined> },
  ): Promise<Record<string, unknown>> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException("Tenant não encontrado.");
    }

    const email = dto.email.trim().toLowerCase();
    const displayName = dto.displayName?.trim() || "Gestor";
    const appUrl = resolveAppPublicUrl(this.config, req);
    const { inviteUrl } = await this.createManagerInvite(
      tenantId,
      email,
      displayName,
      actor.sub,
      appUrl,
    );

    await this.audit.log({
      actorType: "SUPERADMIN_USER",
      actorId: actor.sub,
      actorIp,
      action: "tenant.manager_invite",
      resourceType: "tenant",
      resourceId: tenantId,
      targetTenantId: tenantId,
      payload: { email, slug: tenant.slug },
    });

    void this.tenantNotificacoes
      .enviarConviteGestor({
        email,
        displayName,
        entidadeFormadora: tenant.legalName,
        slug: tenant.slug,
        inviteUrl,
      })
      .catch(() => undefined);

    const isDev = this.config.get<string>("NODE_ENV") !== "production";
    return {
      ok: true,
      email,
      slug: tenant.slug,
      inviteUrl: isDev ? inviteUrl : undefined,
    };
  }

  async updateTenantSubscription(
    actor: RequestUser,
    tenantId: string,
    dto: UpdateTenantSubscriptionDto,
    actorIp?: string,
  ): Promise<Record<string, unknown>> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException("Tenant não encontrado.");
    }

    const planCode = dto.planCode as BillingPlanCode;
    let customAddons: string[];
    try {
      customAddons = assertValidTenantSubscription(planCode, dto.customAddons ?? []);
    } catch (e) {
      if (e instanceof TenantSubscriptionValidationError) {
        throw new BadRequestException(e.message);
      }
      throw e;
    }

    const plan = await this.prisma.subscriptionPlan.findFirst({
      where: { code: planCode, active: true },
    });
    if (!plan) {
      throw new BadRequestException(`Plano «${planCode}» não encontrado ou inactivo.`);
    }

    const sub = await this.prisma.tenantSubscription.findFirst({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
    });
    if (!sub) {
      throw new NotFoundException("Subscrição do tenant não encontrada.");
    }

    await this.prisma.tenantSubscription.update({
      where: { id: sub.id },
      data: {
        planId: plan.id,
        customAddons,
        ...(dto.status ? { status: dto.status } : {}),
      },
    });

    await this.audit.log({
      actorType: "SUPERADMIN_USER",
      actorId: actor.sub,
      actorIp,
      action: "tenant.subscription_update",
      resourceType: "tenant_subscription",
      resourceId: sub.id,
      targetTenantId: tenantId,
      payload: { planCode, customAddons, status: dto.status ?? sub.status },
    });

    void this.tenantNotificacoes
      .notificarSuperadminsTenantLifecycle({
        acao: "actualizado",
        tenant: {
          id: tenant.id,
          slug: tenant.slug,
          legalName: tenant.legalName,
          nif: tenant.nif,
          status: tenant.status,
        },
        actorEmail: actor.email,
        detalhe: `Subscrição: ${plan.name} (${planCode})${customAddons.length ? `\nMódulos: ${customAddons.join(", ")}` : ""}`,
      })
      .catch(() => undefined);

    return this.getTenant(tenantId);
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
    const dash = await this.platformDashboard();
    return {
      tenantsByStatus: dash.tenantsByStatus,
      totalUsers: dash.totalUsers,
      totalAcoes: dash.totalAcoes,
      subscriptionsByStatus: dash.subscriptionsByStatus,
      auditEvents24h: dash.auditEvents24h,
    };
  }

  async platformDashboard() {
    const since24h = new Date(Date.now() - 86_400_000);
    const now = new Date();

    const [
      tenants,
      users,
      acoes,
      subs,
      audit24h,
      sessions24h,
      activeSessions,
      supportByStatus,
      leadsTotal,
      leads24h,
      leadsByEstado,
      propostasTotal,
      propostas24h,
      faturasTotal,
      faturas24h,
      faturasByEstado,
      faturasEmitidasAgg,
      impersonationActive,
      tenantsList,
    ] = await Promise.all([
      this.prisma.tenant.groupBy({ by: ["status"], _count: true }),
      this.prisma.user.count(),
      this.prisma.acaoFormacao.count(),
      this.prisma.tenantSubscription.groupBy({ by: ["status"], _count: true }),
      this.prisma.globalAuditLog.count({ where: { occurredAt: { gte: since24h } } }),
      this.prisma.authRefreshSession.findMany({
        where: { createdAt: { gte: since24h } },
        select: { createdAt: true, subjectKind: true },
      }),
      this.prisma.authRefreshSession.findMany({
        where: { revokedAt: null, expiresAt: { gt: now } },
        select: { subjectId: true, subjectKind: true },
      }),
      this.prisma.supportTicket.groupBy({ by: ["status"], _count: true }),
      this.prisma.leadComercial.count(),
      this.prisma.leadComercial.count({ where: { createdAt: { gte: since24h } } }),
      this.prisma.leadComercial.groupBy({ by: ["estado"], _count: true }),
      this.prisma.propostaComercial.count(),
      this.prisma.propostaComercial.count({ where: { createdAt: { gte: since24h } } }),
      this.prisma.faturaComercial.count(),
      this.prisma.faturaComercial.count({ where: { createdAt: { gte: since24h } } }),
      this.prisma.faturaComercial.groupBy({ by: ["estado"], _count: true }),
      this.prisma.faturaComercial.aggregate({
        where: { estado: { in: ["EMITIDA", "COMUNICADA_AT"] } },
        _sum: { valorCentavos: true },
        _count: true,
      }),
      this.prisma.impersonationSession.count({
        where: { revokedAt: null, expiresAt: { gt: now } },
      }),
      this.prisma.tenant.findMany({
        orderBy: { legalName: "asc" },
        select: {
          id: true,
          slug: true,
          legalName: true,
          status: true,
          _count: {
            select: {
              leadsComerciais: true,
              propostasComerciais: true,
              faturasComerciais: true,
            },
          },
        },
      }),
    ]);

    const tenantOnline = new Set(
      activeSessions.filter((s) => s.subjectKind === "tenant").map((s) => s.subjectId),
    ).size;
    const platformOnline = new Set(
      activeSessions.filter((s) => s.subjectKind === "platform").map((s) => s.subjectId),
    ).size;

    const acessos24h = this.buildHourlyAccessSeries(sessions24h);
    const loginsTenant24h = sessions24h.filter((s) => s.subjectKind === "tenant").length;

    return {
      tenantsByStatus: tenants,
      totalUsers: users,
      totalAcoes: acoes,
      subscriptionsByStatus: subs,
      auditEvents24h: audit24h,
      acessos: {
        onlineAgora: tenantOnline,
        onlinePlataforma: platformOnline,
        logins24h: loginsTenant24h,
        serie24h: acessos24h,
      },
      suporte: {
        porEstado: supportByStatus,
        abertos: supportByStatus.find((s) => s.status === "OPEN")?._count ?? 0,
      },
      crm: {
        leadsTotal,
        leads24h,
        leadsByEstado,
        propostasTotal,
        propostas24h,
        faturasTotal,
        faturas24h,
        faturasByEstado,
        faturasEmitidasCount: faturasEmitidasAgg._count,
        faturasEmitidasEuro: (faturasEmitidasAgg._sum.valorCentavos ?? 0) / 100,
      },
      impersonationActive,
      tenantsCrm: tenantsList.map((t) => ({
        id: t.id,
        slug: t.slug,
        legalName: t.legalName,
        status: t.status,
        leads: t._count.leadsComerciais,
        propostas: t._count.propostasComerciais,
        faturas: t._count.faturasComerciais,
      })),
    };
  }

  async listCrmTenants() {
    const rows = await this.prisma.tenant.findMany({
      orderBy: { legalName: "asc" },
      select: {
        id: true,
        slug: true,
        legalName: true,
        status: true,
        users: {
          where: { role: "ADMIN", active: true },
          take: 1,
          orderBy: { createdAt: "asc" },
          select: { id: true, email: true, displayName: true },
        },
        _count: {
          select: {
            leadsComerciais: true,
            propostasComerciais: true,
            faturasComerciais: true,
          },
        },
      },
    });
    return rows.map((t) => ({
      id: t.id,
      slug: t.slug,
      legalName: t.legalName,
      status: t.status,
      adminUser: t.users[0] ?? null,
      leads: t._count.leadsComerciais,
      propostas: t._count.propostasComerciais,
      faturas: t._count.faturasComerciais,
    }));
  }

  private buildHourlyAccessSeries(
    sessions: { createdAt: Date; subjectKind: string }[],
  ): { hour: string; acessos: number; tenant: number; platform: number }[] {
    const buckets: { hour: string; ts: number; acessos: number; tenant: number; platform: number }[] =
      [];
    for (let i = 23; i >= 0; i--) {
      const d = new Date();
      d.setMinutes(0, 0, 0);
      d.setHours(d.getHours() - i);
      buckets.push({
        hour: d.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" }),
        ts: d.getTime(),
        acessos: 0,
        tenant: 0,
        platform: 0,
      });
    }

    for (const s of sessions) {
      const t = s.createdAt.getTime();
      for (let i = 0; i < buckets.length; i++) {
        const start = buckets[i].ts;
        const end = i < buckets.length - 1 ? buckets[i + 1].ts : Date.now() + 3_600_000;
        if (t >= start && t < end) {
          buckets[i].acessos += 1;
          if (s.subjectKind === "tenant") buckets[i].tenant += 1;
          else buckets[i].platform += 1;
          break;
        }
      }
    }

    return buckets.map(({ hour, acessos, tenant, platform }) => ({
      hour,
      acessos,
      tenant,
      platform,
    }));
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

  private assertPlatformSuperAdmin(user: RequestUser): void {
    if (user.kind !== "platform" || user.role !== "super_admin") {
      throw new ForbiddenException("Apenas super-admin da plataforma.");
    }
  }

  async getPlatformAccount(user: RequestUser): Promise<Record<string, unknown>> {
    this.assertPlatformSuperAdmin(user);
    const row = await this.prisma.platformUser.findUnique({
      where: { id: user.sub },
      select: {
        id: true,
        email: true,
        displayName: true,
        active: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!row) {
      throw new NotFoundException("Conta de plataforma não encontrada.");
    }
    return row;
  }

  async updatePlatformAccount(
    user: RequestUser,
    dto: UpdatePlatformMeDto,
    actorIp?: string,
  ): Promise<{ account: Record<string, unknown>; reauthRequired: boolean }> {
    this.assertPlatformSuperAdmin(user);

    const current = await this.prisma.platformUser.findUnique({
      where: { id: user.sub },
    });
    if (!current?.active) {
      throw new NotFoundException("Conta de plataforma não encontrada.");
    }

    const email = dto.email.toLowerCase().trim();
    const emailChanged = email !== current.email;

    if (emailChanged) {
      const taken = await this.prisma.platformUser.findUnique({ where: { email } });
      if (taken && taken.id !== current.id) {
        throw new ConflictException("Já existe outra conta de plataforma com este email.");
      }
      if (!dto.currentPassword?.trim()) {
        throw new BadRequestException("Indique a palavra-passe actual para alterar o email.");
      }
      const emailPwOk = await argon2.verify(current.passwordHash, dto.currentPassword);
      if (!emailPwOk) {
        throw new UnauthorizedException("Palavra-passe actual incorrecta.");
      }
    }

    if (dto.newPassword) {
      if (!dto.currentPassword) {
        throw new BadRequestException("Indique a palavra-passe actual para definir uma nova.");
      }
      const ok = await argon2.verify(current.passwordHash, dto.currentPassword);
      if (!ok) {
        throw new UnauthorizedException("Palavra-passe actual incorrecta.");
      }
    }

    const data: {
      email: string;
      displayName?: string;
      passwordHash?: string;
    } = { email };

    if (dto.displayName !== undefined) {
      data.displayName = dto.displayName.trim();
    }

    if (dto.newPassword) {
      data.passwordHash = await argon2.hash(dto.newPassword, { type: argon2.argon2id });
    }

    const account = await this.prisma.platformUser.update({
      where: { id: current.id },
      data,
      select: {
        id: true,
        email: true,
        displayName: true,
        active: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await this.audit.log({
      actorType: "SUPERADMIN_USER",
      actorId: user.sub,
      actorIp,
      action: "platform_user.update",
      resourceType: "platform_user",
      resourceId: current.id,
      payload: {
        emailChanged,
        passwordChanged: Boolean(dto.newPassword),
        displayNameChanged: dto.displayName !== undefined,
      },
    });

    return { account, reauthRequired: emailChanged || Boolean(dto.newPassword) };
  }
}
