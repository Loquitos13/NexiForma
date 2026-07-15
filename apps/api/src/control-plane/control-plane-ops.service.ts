import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { promises as dns } from "dns";
import type { PlatformAlertStatus, Prisma } from "@nexiforma/database";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/types/access-token-payload";

type TenantIssue = {
  code: string;
  severity: "warning" | "error" | "info";
  message: string;
  count?: number;
  link?: string;
};

type TenantActivity = {
  periodHours: number;
  leads: number;
  clientes: number;
  propostas: number;
  faturas: number;
  cursos: number;
  acoes: number;
  modulosLms: number;
  matriculas: number;
  errosHttp: number;
};

@Injectable()
export class ControlPlaneOpsService {
  private readonly logger = new Logger(ControlPlaneOpsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async getDashboard() {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [
      tenantsTotal,
      tenantsActive,
      openAlerts,
      alerts24h,
      healthFailed,
      salesLeadsOpen,
      subsPastDue,
    ] = await Promise.all([
      this.prisma.tenant.count(),
      this.prisma.tenant.count({ where: { status: "ACTIVE" } }),
      this.prisma.platformHttpAlert.count({ where: { status: "OPEN" } }),
      this.prisma.platformHttpAlert.count({ where: { occurredAt: { gte: since24h } } }),
      this.prisma.tenantHealthCheck.count({
        where: {
          checkedAt: { gte: since24h },
          OR: [{ portalUp: false }, { apiUp: false }, { dnsOk: false }],
        },
      }),
      this.prisma.platformSalesLead.count({ where: { status: "NOVO" } }),
      this.prisma.tenantSubscription.count({ where: { status: "PAST_DUE" } }),
    ]);

    const recentAlerts = await this.prisma.platformHttpAlert.findMany({
      orderBy: { occurredAt: "desc" },
      take: 12,
      select: {
        id: true,
        statusCode: true,
        httpMethod: true,
        httpPath: true,
        resumo: true,
        tenantSlug: true,
        status: true,
        severity: true,
        occurredAt: true,
      },
    });

    const tenantSnapshots = await this.latestHealthByTenant();

    return {
      summary: {
        tenantsTotal,
        tenantsActive,
        openAlerts,
        alerts24h,
        healthIssues24h: healthFailed,
        salesLeadsOpen,
        subsPastDue,
      },
      recentAlerts,
      tenants: tenantSnapshots,
    };
  }

  async listAlerts(opts?: {
    status?: PlatformAlertStatus;
    tenantId?: string;
    limit?: number;
  }) {
    const where: Prisma.PlatformHttpAlertWhereInput = {};
    if (opts?.status) where.status = opts.status;
    if (opts?.tenantId) where.tenantId = opts.tenantId;

    return this.prisma.platformHttpAlert.findMany({
      where,
      orderBy: { occurredAt: "desc" },
      take: Math.min(opts?.limit ?? 80, 200),
      include: {
        tenant: { select: { id: true, slug: true, legalName: true, status: true } },
      },
    });
  }

  async getAlert(id: string) {
    const row = await this.prisma.platformHttpAlert.findUnique({
      where: { id },
      include: {
        tenant: { select: { id: true, slug: true, legalName: true, status: true } },
      },
    });
    if (!row) throw new NotFoundException("Alerta não encontrado.");
    return row;
  }

  async updateAlertStatus(
    id: string,
    status: PlatformAlertStatus,
    user: RequestUser,
  ) {
    const row = await this.getAlert(id);
    return this.prisma.platformHttpAlert.update({
      where: { id: row.id },
      data: {
        status,
        resolvedAt: status === "RESOLVED" ? new Date() : null,
        resolvedBy: status === "RESOLVED" ? user.sub : null,
      },
    });
  }

  async getTenantOps(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        slug: true,
        legalName: true,
        status: true,
        metadata: true,
        createdAt: true,
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
    if (!tenant) throw new NotFoundException("Tenant não encontrado.");

    const [activity, issues, openAlerts, latestHealth, healthHistory] = await Promise.all([
      this.computeTenantActivity(tenantId, 24),
      this.detectTenantIssues(tenantId),
      this.prisma.platformHttpAlert.count({
        where: { tenantId, status: "OPEN" },
      }),
      this.prisma.tenantHealthCheck.findFirst({
        where: { tenantId },
        orderBy: { checkedAt: "desc" },
      }),
      this.prisma.tenantHealthCheck.findMany({
        where: { tenantId },
        orderBy: { checkedAt: "desc" },
        take: 10,
      }),
    ]);

    return {
      tenant,
      activity,
      issues,
      openAlerts,
      latestHealth,
      healthHistory,
    };
  }

  async runHealthChecks(tenantId?: string) {
    const tenants = await this.prisma.tenant.findMany({
      where: {
        ...(tenantId ? { id: tenantId } : {}),
        status: { in: ["ACTIVE", "TRIAL"] },
      },
      select: { id: true, slug: true, metadata: true },
    });

    const results = [];
    for (const t of tenants) {
      try {
        results.push(await this.checkTenantHealth(t.id, t.slug, t.metadata));
      } catch (err) {
        this.logger.warn(`Health check falhou (${t.slug}): ${String(err)}`);
      }
    }
    return { checked: results.length, results };
  }

  private async latestHealthByTenant() {
    const tenants = await this.prisma.tenant.findMany({
      where: { status: { in: ["ACTIVE", "TRIAL", "SUSPENDED"] } },
      select: { id: true, slug: true, legalName: true, status: true },
      orderBy: { legalName: "asc" },
    });

    const out = [];
    for (const t of tenants) {
      const [health, openAlerts, activity] = await Promise.all([
        this.prisma.tenantHealthCheck.findFirst({
          where: { tenantId: t.id },
          orderBy: { checkedAt: "desc" },
        }),
        this.prisma.platformHttpAlert.count({
          where: { tenantId: t.id, status: "OPEN" },
        }),
        this.computeTenantActivity(t.id, 24),
      ]);
      out.push({
        ...t,
        health,
        openAlerts,
        activity,
      });
    }
    return out;
  }

  private async checkTenantHealth(
    tenantId: string,
    slug: string,
    metadata: unknown,
  ) {
    const dnsHost = this.resolveTenantHost(slug, metadata);
    const [dnsResult, portalUp, apiUp, activity, issues] = await Promise.all([
      this.checkDns(dnsHost),
      this.pingPortal(),
      this.pingApi(),
      this.computeTenantActivity(tenantId, 24),
      this.detectTenantIssues(tenantId),
    ]);

    const row = await this.prisma.tenantHealthCheck.create({
      data: {
        tenantId,
        portalUp,
        apiUp,
        dnsOk: dnsResult.ok,
        dnsHost,
        dnsDetail: dnsResult.detail,
        issues: issues as unknown as Prisma.InputJsonValue,
        activity: activity as unknown as Prisma.InputJsonValue,
      },
    });

    return row;
  }

  private resolveTenantHost(slug: string, metadata: unknown): string {
    const meta = metadata as Record<string, unknown> | null;
    const custom =
      (typeof meta?.customDomain === "string" && meta.customDomain) ||
      (typeof meta?.dominio === "string" && meta.dominio) ||
      (typeof meta?.website === "string" && meta.website.replace(/^https?:\/\//, "").split("/")[0]);
    if (custom) return custom.replace(/\/$/, "");

    const appUrl = this.config.get<string>("APP_PUBLIC_URL") ?? "http://localhost:3000";
    try {
      const host = new URL(appUrl).hostname;
      if (host === "localhost" || host === "127.0.0.1") return host;
      return `${slug}.${host.replace(/^www\./, "")}`;
    } catch {
      return `${slug}.nexiforma.pt`;
    }
  }

  private async checkDns(host: string): Promise<{ ok: boolean; detail: string }> {
    if (host === "localhost" || host === "127.0.0.1") {
      return { ok: true, detail: "Ambiente local - DNS ignorado." };
    }
    try {
      const records = await Promise.race([
        dns.resolve4(host).catch(() => dns.resolveCname(host)),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), 5000),
        ),
      ]);
      return {
        ok: Array.isArray(records) && records.length > 0,
        detail: `Registos: ${JSON.stringify(records)}`,
      };
    } catch (err) {
      return {
        ok: false,
        detail: err instanceof Error ? err.message : String(err),
      };
    }
  }

  private async pingPortal(): Promise<boolean> {
    const url = this.config.get<string>("APP_PUBLIC_URL") ?? "http://localhost:3000";
    try {
      const res = await fetch(url.replace(/\/$/, "") + "/login", {
        method: "GET",
        signal: AbortSignal.timeout(8000),
      });
      return res.status < 500;
    } catch {
      return false;
    }
  }

  private async pingApi(): Promise<boolean> {
    const base =
      this.config.get<string>("API_URL") ??
      this.config.get<string>("NEXT_PUBLIC_API_URL") ??
      "http://127.0.0.1:4000";
    try {
      const res = await fetch(`${base.replace(/\/$/, "")}/v1/health`, {
        signal: AbortSignal.timeout(5000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  private async computeTenantActivity(
    tenantId: string,
    periodHours: number,
  ): Promise<TenantActivity> {
    const since = new Date(Date.now() - periodHours * 60 * 60 * 1000);
    const [
      leads,
      clientes,
      propostas,
      faturas,
      cursos,
      acoes,
      modulosLms,
      matriculas,
      errosHttp,
    ] = await Promise.all([
      this.prisma.leadComercial.count({ where: { tenantId, createdAt: { gte: since } } }),
      this.prisma.entidadeCliente.count({ where: { tenantId, createdAt: { gte: since } } }),
      this.prisma.propostaComercial.count({ where: { tenantId, createdAt: { gte: since } } }),
      this.prisma.faturaComercial.count({ where: { tenantId, createdAt: { gte: since } } }),
      this.prisma.curso.count({ where: { tenantId, createdAt: { gte: since } } }),
      this.prisma.acaoFormacao.count({ where: { tenantId, createdAt: { gte: since } } }),
      this.prisma.moduloConteudo.count({ where: { tenantId, createdAt: { gte: since } } }),
      this.prisma.matricula.count({ where: { tenantId, dataInscricao: { gte: since } } }),
      this.prisma.platformHttpAlert.count({
        where: { tenantId, occurredAt: { gte: since }, statusCode: { gte: 400 } },
      }),
    ]);

    return {
      periodHours,
      leads,
      clientes,
      propostas,
      faturas,
      cursos,
      acoes,
      modulosLms,
      matriculas,
      errosHttp,
    };
  }

  private async detectTenantIssues(tenantId: string): Promise<TenantIssue[]> {
    const issues: TenantIssue[] = [];
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const sub = await this.prisma.tenantSubscription.findFirst({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      select: { status: true },
    });
    if (sub?.status === "PAST_DUE") {
      issues.push({
        code: "SUBSCRIPTION_PAST_DUE",
        severity: "error",
        message: "Subscrição em atraso de pagamento.",
        link: `/plataforma/tenantes/${tenantId}`,
      });
    }

    const faturasAtFalha = await this.prisma.faturaComunicacaoAt.count({
      where: {
        fatura: { tenantId },
        sucesso: false,
        tentativaEm: { gte: since7d },
      },
    });
    if (faturasAtFalha > 0) {
      issues.push({
        code: "FATURA_AT_FALHA",
        severity: "error",
        message: "Falhas na comunicação de faturas à AT.",
        count: faturasAtFalha,
      });
    }

    const propostasPendentes = await this.prisma.propostaComercial.count({
      where: {
        tenantId,
        estado: { in: ["ENVIADA", "RASCUNHO"] },
        updatedAt: { lt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
      },
    });
    if (propostasPendentes > 0) {
      issues.push({
        code: "PROPOSTAS_STALE",
        severity: "warning",
        message: "Propostas sem movimento há mais de 14 dias.",
        count: propostasPendentes,
      });
    }

    const leadsNovos = await this.prisma.leadComercial.count({
      where: { tenantId, estado: "NOVO", createdAt: { lt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) } },
    });
    if (leadsNovos > 0) {
      issues.push({
        code: "LEADS_SEM_CONTACTO",
        severity: "warning",
        message: "Leads novos sem contacto há mais de 3 dias.",
        count: leadsNovos,
      });
    }

    const openErrors = await this.prisma.platformHttpAlert.count({
      where: { tenantId, status: "OPEN", statusCode: { gte: 500 } },
    });
    if (openErrors > 0) {
      issues.push({
        code: "HTTP_5XX_OPEN",
        severity: "error",
        message: "Erros HTTP 5xx em aberto.",
        count: openErrors,
      });
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { status: true },
    });
    if (tenant?.status === "SUSPENDED") {
      issues.push({
        code: "TENANT_SUSPENDED",
        severity: "warning",
        message: "Tenant suspenso.",
      });
    }

    return issues;
  }
}
