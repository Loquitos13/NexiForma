import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { SigoIntegrationService } from "./sigo-integration.service";
import { SigoCertificatesService } from "./sigo-certificates.service";

/**
 * Reconcilia submissões SIGO pendentes e sincroniza certificados de submissões aceites.
 * Activar com CRON_SIGO_ENABLED=true (partilha CRON_NOTIFICACOES_ENABLED como fallback).
 */
@Injectable()
export class SigoSchedulerService {
  private readonly logger = new Logger(SigoSchedulerService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly sigo: SigoIntegrationService,
    private readonly certificados: SigoCertificatesService,
  ) {}

  private enabled(): boolean {
    const dedicated = this.config.get<string>("CRON_SIGO_ENABLED");
    if (dedicated === "true") return true;
    if (dedicated === "false") return false;
    return this.config.get<string>("CRON_NOTIFICACOES_ENABLED") === "true";
  }

  @Cron("0 */15 * * * *")
  async reconciliarPendentes() {
    if (!this.enabled()) return;

    const pendentes = await this.prisma.sigoSubmissao.findMany({
      where: {
        estado: { in: ["SUBMETIDA", "PENDENTE"] },
        tenant: {
          configSigo: { is: { integracaoAtiva: true } },
        },
      },
      select: { id: true, tenantId: true },
      take: 50,
      orderBy: { submittedAt: "asc" },
    });

    for (const row of pendentes) {
      try {
        await this.sigo.reconcileForTenant(row.tenantId, row.id);
      } catch (err) {
        this.logger.warn(`Reconciliação SIGO cron (${row.id}): ${String(err)}`);
      }
    }
  }

  @Cron(CronExpression.EVERY_30_MINUTES)
  async sincronizarCertificadosAceites() {
    if (!this.enabled()) return;

    const aceites = await this.prisma.sigoSubmissao.findMany({
      where: {
        estado: "ACEITE",
        tenant: {
          configSigo: { is: { integracaoAtiva: true } },
        },
      },
      select: { id: true, tenantId: true },
      take: 30,
      orderBy: { reconciledAt: "desc" },
    });

    for (const row of aceites) {
      const semPdf = await this.prisma.sigoCertificadoFormando.count({
        where: {
          submissaoId: row.id,
          tenantId: row.tenantId,
          estado: "DISPONIVEL",
          storageKey: null,
        },
      });
      if (!semPdf) continue;

      try {
        await this.certificados.syncForTenant(row.tenantId, row.id);
      } catch (err) {
        this.logger.warn(`Sync certificados SIGO cron (${row.id}): ${String(err)}`);
      }
    }
  }
}
