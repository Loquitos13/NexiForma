import { createHmac } from "node:crypto";
import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { FormacoesCatalogService } from "./formacoes-catalog.service";
import type {
  TenantWebsiteSyncConfig,
  WebsiteSyncEvent,
  WebsiteSyncPayload,
} from "./formacoes-website.types";
import { PortalNotificacoesService } from "../notificacoes/portal-notificacoes.service";
import { PlatformAlertasService } from "../notificacoes/platform-alertas.service";

type TenantMeta = {
  websiteSync?: TenantWebsiteSyncConfig;
};

@Injectable()
export class FormacoesPublishService {
  private readonly logger = new Logger(FormacoesPublishService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: FormacoesCatalogService,
    private readonly config: ConfigService,
    private readonly portalNotificacoes: PortalNotificacoesService,
    private readonly platformAlertas: PlatformAlertasService,
  ) {}

  async getWebsiteConfig(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { metadata: true },
    });
    const sync = ((tenant?.metadata ?? {}) as TenantMeta).websiteSync ?? {};
    return {
      enabled: sync.enabled ?? false,
      webhookUrl: sync.webhookUrl ?? "",
      hasSecret: !!sync.webhookSecret?.trim(),
      lastSyncAt: sync.lastSyncAt ?? null,
      lastSyncStatus: sync.lastSyncStatus ?? null,
      lastSyncError: sync.lastSyncError ?? null,
    };
  }

  async updateWebsiteConfig(
    tenantId: string,
    input: {
      enabled?: boolean;
      webhookUrl?: string;
      webhookSecret?: string;
    },
  ) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { metadata: true },
    });
    if (!tenant) {
      throw new BadRequestException("Tenant não encontrado.");
    }

    const meta = (tenant.metadata ?? {}) as TenantMeta;
    const prev = meta.websiteSync ?? {};
    const next: TenantWebsiteSyncConfig = {
      ...prev,
      ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
      ...(input.webhookUrl !== undefined
        ? { webhookUrl: input.webhookUrl.trim() || undefined }
        : {}),
      ...(input.webhookSecret !== undefined
        ? { webhookSecret: input.webhookSecret.trim() || undefined }
        : {}),
    };

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { metadata: { ...meta, websiteSync: next } as object },
    });

    return this.getWebsiteConfig(tenantId);
  }

  /** Dispara sync completo sem bloquear o pedido HTTP. */
  scheduleFullCatalogSync(tenantId: string, event: WebsiteSyncEvent = "catalog.full_sync") {
    setImmediate(() => {
      void this.pushFullCatalog(tenantId, event).catch((err) => {
        this.logger.error(`Sync website falhou (tenant ${tenantId}): ${err?.message ?? err}`);
      });
    });
  }

  scheduleFormacaoEvent(
    tenantId: string,
    event: WebsiteSyncEvent,
    cursoUuid: string,
  ) {
    setImmediate(() => {
      void this.pushFormacaoItem(tenantId, event, cursoUuid).catch((err) => {
        this.logger.error(`Publish formação falhou: ${err?.message ?? err}`);
      });
    });
  }

  async pushFullCatalog(tenantId: string, event: WebsiteSyncEvent = "catalog.full_sync") {
    const cfg = await this.readSyncConfig(tenantId);
    if (!cfg?.enabled || !cfg.webhookUrl) {
      return { skipped: true, reason: "website_sync_disabled" };
    }

    const catalog = await this.catalog.getFullPublicCatalog(tenantId);
    const payload: WebsiteSyncPayload = {
      event,
      tenantId,
      timestamp: new Date().toISOString(),
      catalog,
    };

    return this.deliverWebhook(tenantId, cfg, payload);
  }

  private async pushFormacaoItem(
    tenantId: string,
    event: WebsiteSyncEvent,
    cursoUuid: string,
  ) {
    const cfg = await this.readSyncConfig(tenantId);
    if (!cfg?.enabled || !cfg.webhookUrl) {
      return { skipped: true };
    }

    const appUrl = this.config.get<string>("APP_PUBLIC_URL") ?? "http://localhost:3000";
    const formacao = await this.catalog.getFormacaoPublicaByUuid(tenantId, cursoUuid, appUrl);

    const payload: WebsiteSyncPayload = {
      event,
      tenantId,
      timestamp: new Date().toISOString(),
      formacao: formacao ?? { uuid: cursoUuid, publicado: false },
    };

    return this.deliverWebhook(tenantId, cfg, payload);
  }

  private async readSyncConfig(tenantId: string): Promise<TenantWebsiteSyncConfig | null> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { metadata: true },
    });
    return ((tenant?.metadata ?? {}) as TenantMeta).websiteSync ?? null;
  }

  private async deliverWebhook(
    tenantId: string,
    cfg: TenantWebsiteSyncConfig,
    payload: WebsiteSyncPayload,
  ) {
    const url = cfg.webhookUrl!.trim();
    const body = JSON.stringify(payload);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "NexiForma-WebsiteSync/1.0",
    };

    if (cfg.webhookSecret?.trim()) {
      const sig = createHmac("sha256", cfg.webhookSecret.trim())
        .update(body)
        .digest("hex");
      headers["X-NexiForma-Signature"] = `sha256=${sig}`;
    }

    let status: "ok" | "error" = "ok";
    let errorMsg: string | undefined;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body,
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) {
        status = "error";
        errorMsg = `HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`;
      }
    } catch (err) {
      status = "error";
      errorMsg = err instanceof Error ? err.message : String(err);
    }

    await this.persistSyncStatus(tenantId, status, errorMsg);

    if (status === "error") {
      this.logger.warn(`Webhook website ${url} falhou: ${errorMsg}`);
      void this.notificarFalhaSync(tenantId, payload.event, errorMsg ?? "Erro desconhecido").catch(
        (err) => {
          this.logger.warn(`Email falha sync website: ${err?.message ?? err}`);
        },
      );
    } else {
      this.logger.log(`Catálogo publicado no website (${payload.event}, tenant ${tenantId})`);
    }

    return { ok: status === "ok", error: errorMsg };
  }

  private async notificarFalhaSync(
    tenantId: string,
    evento: WebsiteSyncEvent,
    erro: string,
  ) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { legalName: true },
    });
    const appUrl = this.config.get<string>("APP_PUBLIC_URL") ?? "http://localhost:3000";
    const portalUrl = `${appUrl}/portal/formacoes`;
    const entidade = tenant?.legalName ?? "Entidade formadora";

    await this.portalNotificacoes.notifyGestores(tenantId, {
      tipo: "website_sync_erro",
      titulo: "Sync website falhou",
      mensagem: `${evento}: ${erro.slice(0, 200)}`,
      link: "/portal/formacoes",
      buildEmail: (dest) =>
        this.portalNotificacoes.buildWebsiteSyncFalhouEmail({
          nomeDestinatario: dest.displayName,
          entidade,
          evento,
          erro: erro.slice(0, 500),
          portalUrl,
        }),
    });

    void this.platformAlertas
      .notificarErroServidor({
        tenantId,
        tenantNome: entidade,
        modulo: "formacoes-website-sync",
        resumo: `Webhook sync falhou (${evento})`,
        detalhe: erro.slice(0, 500),
        httpMethod: "POST",
        httpPath: "(webhook tenant)",
      })
      .catch((err) => {
        this.logger.warn(`Alerta superadmin falhou: ${err?.message ?? err}`);
      });
  }

  private async persistSyncStatus(
    tenantId: string,
    status: "ok" | "error",
    error?: string,
  ) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { metadata: true },
    });
    const meta = (tenant?.metadata ?? {}) as TenantMeta;
    const sync = meta.websiteSync ?? {};
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        metadata: {
          ...meta,
          websiteSync: {
            ...sync,
            lastSyncAt: new Date().toISOString(),
            lastSyncStatus: status,
            lastSyncError: error ?? null,
          },
        } as object,
      },
    });
  }
}
