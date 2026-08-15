import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Prisma } from "@nexiforma/database";
import { PrismaService } from "../prisma/prisma.service";
import type { ExternalServiceId } from "../common/external-service-event.service";

export type ExternalServiceHealthStatus = "UP" | "DOWN" | "NOT_CONFIGURED";

export type ExternalServiceHealthItem = {
  id: ExternalServiceId;
  label: string;
  description: string;
  status: ExternalServiceHealthStatus;
  configured: boolean;
  failureCount: number;
  tenantsAffected: number;
  lastFailureAt: string | null;
  lastFailureMessage: string | null;
  detail: string | null;
};

export type ExternalServicesStatusResponse = {
  windowHours: number;
  evaluatedAt: string;
  rule: string;
  services: ExternalServiceHealthItem[];
};

type FailureAggregate = {
  count: number;
  tenantIds: Set<string>;
  lastAt: Date | null;
  lastMessage: string | null;
};

@Injectable()
export class ExternalServicesStatusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async getStatus(windowHours = 168): Promise<ExternalServicesStatusResponse> {
    const hours = Math.min(Math.max(windowHours, 1), 24 * 30);
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const evaluatedAt = new Date().toISOString();

    const [
      brevoConfigured,
      personaConfigured,
      teamsConfigured,
      atConfigured,
      sigoConfigured,
      nifConfigured,
      auditErrors,
      brevoAlerts,
      personaAlerts,
      teamsAlerts,
      nifAlerts,
      atFailures,
      sigoSubFailures,
      sigoSyncFailures,
      personaInquiryFailures,
    ] = await Promise.all([
      Promise.resolve(this.isBrevoConfigured()),
      Promise.resolve(this.isPersonaConfigured()),
      Promise.resolve(this.isTeamsConfigured()),
      Promise.resolve(this.isAtConfigured()),
      Promise.resolve(this.isSigoConfigured()),
      Promise.resolve(this.isNifConfigured()),
      this.loadAuditErrors(since),
      this.loadHttpAlerts(since, ["ext-brevo", "integration-brevo"], ["brevo", "smtp/email"]),
      this.loadHttpAlerts(since, ["ext-persona", "integration-persona"], ["/persona/"]),
      this.loadHttpAlerts(since, ["ext-teams", "integration-teams"], ["graph.microsoft.com", "/integracoes"]),
      this.loadHttpAlerts(since, ["ext-nif_pt", "integration-nif"], ["/nif/"]),
      this.loadAtFailures(since),
      this.loadSigoSubmissaoFailures(since),
      this.loadSigoSyncFailures(since),
      this.loadPersonaInquiryFailures(since),
    ]);

    const services: ExternalServiceHealthItem[] = [
      this.buildItem({
        id: "brevo",
        label: "Brevo (email)",
        description: "Envio transaccional de emails via API Brevo.",
        configured: brevoConfigured,
        aggregates: [
          auditErrors.brevo,
          brevoAlerts,
        ],
      }),
      this.buildItem({
        id: "persona",
        label: "Persona (identidade)",
        description: "Verificação de identidade KYC para formandos e formadores.",
        configured: personaConfigured,
        aggregates: [auditErrors.persona, personaAlerts, personaInquiryFailures],
      }),
      this.buildItem({
        id: "teams",
        label: "Microsoft Teams",
        description: "Reuniões online via Microsoft Graph.",
        configured: teamsConfigured,
        aggregates: [auditErrors.teams, teamsAlerts],
      }),
      this.buildItem({
        id: "at",
        label: "AT (faturação)",
        description: "Comunicação de faturas à Autoridade Tributária.",
        configured: atConfigured,
        aggregates: [atFailures],
      }),
      this.buildItem({
        id: "sigo",
        label: "SIGO / DGEEC",
        description: "Submissões e sincronização de formandos no SIGO.",
        configured: sigoConfigured,
        aggregates: [sigoSubFailures, sigoSyncFailures, auditErrors.sigo],
      }),
      this.buildItem({
        id: "nif_pt",
        label: "NIF.PT",
        description: "Confirmação de NIF de empresas (integridade fiscal).",
        configured: nifConfigured,
        aggregates: [auditErrors.nif_pt, nifAlerts],
      }),
    ];

    return {
      windowHours: hours,
      evaluatedAt,
      rule:
        "UP quando não existem erros registados para o serviço em nenhum tenant na janela indicada; DOWN se houve falhas; NOT_CONFIGURED se credenciais/modo estão desactivados.",
      services,
    };
  }

  private buildItem(input: {
    id: ExternalServiceId;
    label: string;
    description: string;
    configured: boolean;
    aggregates: FailureAggregate[];
  }): ExternalServiceHealthItem {
    const merged = this.mergeAggregates(input.aggregates);
    let status: ExternalServiceHealthStatus;
    if (!input.configured) {
      status = "NOT_CONFIGURED";
    } else if (merged.count === 0) {
      status = "UP";
    } else {
      status = "DOWN";
    }

    let detail: string | null = null;
    if (!input.configured) {
      detail = "Serviço não configurado na plataforma (variáveis de ambiente ou modo desactivado).";
    } else if (merged.count === 0) {
      detail = "Sem erros registados na janela analisada.";
    } else {
      detail = `${merged.count} erro(s) em ${merged.tenantIds.size} tenant(s).`;
    }

    return {
      id: input.id,
      label: input.label,
      description: input.description,
      status,
      configured: input.configured,
      failureCount: merged.count,
      tenantsAffected: merged.tenantIds.size,
      lastFailureAt: merged.lastAt?.toISOString() ?? null,
      lastFailureMessage: merged.lastMessage,
      detail,
    };
  }

  private mergeAggregates(items: FailureAggregate[]): FailureAggregate {
    const tenantIds = new Set<string>();
    let count = 0;
    let lastAt: Date | null = null;
    let lastMessage: string | null = null;

    for (const item of items) {
      count += item.count;
      for (const tid of item.tenantIds) tenantIds.add(tid);
      if (item.lastAt && (!lastAt || item.lastAt > lastAt)) {
        lastAt = item.lastAt;
        lastMessage = item.lastMessage;
      }
    }

    return { count, tenantIds, lastAt, lastMessage };
  }

  private emptyAggregate(): FailureAggregate {
    return { count: 0, tenantIds: new Set(), lastAt: null, lastMessage: null };
  }

  private isBrevoConfigured(): boolean {
    const provider = (this.config.get<string>("MAIL_PROVIDER") ?? "").toLowerCase();
    if (provider === "brevo" || this.config.get<string>("BREVO_API_KEY")?.trim()) return true;
    const host = (this.config.get<string>("SMTP_HOST") ?? "").toLowerCase();
    return host.includes("brevo") || host.includes("sendinblue");
  }

  private isPersonaConfigured(): boolean {
    return Boolean(this.config.get<string>("PERSONA_API_KEY")?.trim());
  }

  private isTeamsConfigured(): boolean {
    const clientId =
      this.config.get<string>("NEXIFORMA_TEAMS_CLIENT_ID")?.trim() ||
      this.config.get<string>("TEAMS_CLIENT_ID")?.trim();
    const secret =
      this.config.get<string>("NEXIFORMA_TEAMS_CLIENT_SECRET")?.trim() ||
      this.config.get<string>("TEAMS_CLIENT_SECRET")?.trim();
    return Boolean(clientId && secret);
  }

  private isAtConfigured(): boolean {
    const mode = (this.config.get<string>("AT_FATURAS_MODE") ?? "disabled").toLowerCase();
    return mode !== "disabled";
  }

  private isSigoConfigured(): boolean {
    const mode = (this.config.get<string>("SIGO_API_MODE") ?? "disabled").toLowerCase();
    return mode !== "disabled";
  }

  private isNifConfigured(): boolean {
    return Boolean(this.config.get<string>("NIF_PT_API_KEY")?.trim());
  }

  private async loadAuditErrors(since: Date): Promise<Record<ExternalServiceId, FailureAggregate>> {
    const rows = await this.prisma.globalAuditLog.findMany({
      where: {
        occurredAt: { gte: since },
        action: { startsWith: "external.error." },
      },
      orderBy: { occurredAt: "desc" },
      take: 500,
      select: {
        action: true,
        occurredAt: true,
        targetTenantId: true,
        payload: true,
      },
    });

    const map: Record<ExternalServiceId, FailureAggregate> = {
      brevo: this.emptyAggregate(),
      persona: this.emptyAggregate(),
      teams: this.emptyAggregate(),
      at: this.emptyAggregate(),
      sigo: this.emptyAggregate(),
      nif_pt: this.emptyAggregate(),
    };

    for (const row of rows) {
      const service = row.action.replace("external.error.", "") as ExternalServiceId;
      if (!(service in map)) continue;
      const agg = map[service];
      agg.count += 1;
      if (row.targetTenantId) agg.tenantIds.add(row.targetTenantId);
      if (!agg.lastAt || row.occurredAt > agg.lastAt) {
        agg.lastAt = row.occurredAt;
        const payload = row.payload as { message?: string } | null;
        agg.lastMessage = payload?.message?.slice(0, 280) ?? row.action;
      }
    }

    return map;
  }

  private async loadHttpAlerts(
    since: Date,
    modulos: string[],
    pathHints: string[],
  ): Promise<FailureAggregate> {
    const or: Prisma.PlatformHttpAlertWhereInput[] = [
      { modulo: { in: modulos } },
      ...pathHints.flatMap((hint) => [
        { httpPath: { contains: hint, mode: "insensitive" as const } },
        { resumo: { contains: hint, mode: "insensitive" as const } },
      ]),
    ];

    const rows = await this.prisma.platformHttpAlert.findMany({
      where: {
        occurredAt: { gte: since },
        OR: or,
      },
      orderBy: { occurredAt: "desc" },
      take: 200,
      select: {
        occurredAt: true,
        resumo: true,
        tenantId: true,
      },
    });

    const agg = this.emptyAggregate();
    agg.count = rows.length;
    for (const row of rows) {
      if (row.tenantId) agg.tenantIds.add(row.tenantId);
    }
    if (rows[0]) {
      agg.lastAt = rows[0].occurredAt;
      agg.lastMessage = rows[0].resumo.slice(0, 280);
    }
    return agg;
  }

  private async loadAtFailures(since: Date): Promise<FailureAggregate> {
    const rows = await this.prisma.faturaComunicacaoAt.findMany({
      where: { sucesso: false, tentativaEm: { gte: since } },
      orderBy: { tentativaEm: "desc" },
      take: 200,
      select: {
        tentativaEm: true,
        mensagemAt: true,
        fatura: { select: { tenantId: true } },
      },
    });

    const agg = this.emptyAggregate();
    agg.count = rows.length;
    for (const row of rows) {
      agg.tenantIds.add(row.fatura.tenantId);
    }
    if (rows[0]) {
      agg.lastAt = rows[0].tentativaEm;
      agg.lastMessage = rows[0].mensagemAt?.slice(0, 280) ?? "Falha na comunicação à AT";
    }
    return agg;
  }

  private async loadSigoSubmissaoFailures(since: Date): Promise<FailureAggregate> {
    const rows = await this.prisma.sigoSubmissao.findMany({
      where: { estado: "ERRO", createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { tenantId: true, createdAt: true, erros: true },
    });

    const agg = this.emptyAggregate();
    agg.count = rows.length;
    for (const row of rows) {
      agg.tenantIds.add(row.tenantId);
    }
    if (rows[0]) {
      agg.lastAt = rows[0].createdAt;
      agg.lastMessage = this.sigoErroResumo(rows[0].erros) ?? "Submissão SIGO com erro";
    }
    return agg;
  }

  private async loadSigoSyncFailures(since: Date): Promise<FailureAggregate> {
    const rows = await this.prisma.sigoSincronizacaoFormando.findMany({
      where: { estado: "ERRO", updatedAt: { gte: since } },
      orderBy: { updatedAt: "desc" },
      take: 200,
      select: {
        tenantId: true,
        updatedAt: true,
        soapFaultString: true,
        responseResumo: true,
      },
    });

    const agg = this.emptyAggregate();
    agg.count = rows.length;
    for (const row of rows) {
      agg.tenantIds.add(row.tenantId);
    }
    if (rows[0]) {
      agg.lastAt = rows[0].updatedAt;
      agg.lastMessage =
        rows[0].soapFaultString?.slice(0, 280) ??
        rows[0].responseResumo?.slice(0, 280) ??
        "Sincronização SIGO com erro";
    }
    return agg;
  }

  private async loadPersonaInquiryFailures(since: Date): Promise<FailureAggregate> {
    const rows = await this.prisma.personaInquiry.findMany({
      where: { status: "failed", updatedAt: { gte: since } },
      orderBy: { updatedAt: "desc" },
      take: 200,
      select: { tenantId: true, updatedAt: true, personaStatus: true },
    });

    const agg = this.emptyAggregate();
    agg.count = rows.length;
    for (const row of rows) {
      agg.tenantIds.add(row.tenantId);
    }
    if (rows[0]) {
      agg.lastAt = rows[0].updatedAt;
      agg.lastMessage = rows[0].personaStatus
        ? `Inquiry Persona falhou (${rows[0].personaStatus})`
        : "Inquiry Persona falhou";
    }
    return agg;
  }

  private sigoErroResumo(erros: unknown): string | null {
    if (!erros) return null;
    if (typeof erros === "string") return erros.slice(0, 280);
    if (Array.isArray(erros)) {
      const first = erros[0];
      if (typeof first === "string") return first.slice(0, 280);
      if (first && typeof first === "object" && "mensagem" in first) {
        return String((first as { mensagem?: string }).mensagem ?? "").slice(0, 280);
      }
    }
    try {
      return JSON.stringify(erros).slice(0, 280);
    } catch {
      return null;
    }
  }
}
