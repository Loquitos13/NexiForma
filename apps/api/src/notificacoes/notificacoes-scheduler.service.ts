import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { NotificacoesService } from "./notificacoes.service";
import { NotificacoesExtendedService } from "./notificacoes-extended.service";
import { ComplianceService } from "../compliance/compliance.service";

/**
 * Tarefas agendadas de notificações (lembretes, digest, resumo inspeção).
 * Activar com CRON_NOTIFICACOES_ENABLED=true
 */
@Injectable()
export class NotificacoesSchedulerService {
  private readonly logger = new Logger(NotificacoesSchedulerService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly notificacoes: NotificacoesService,
    private readonly extended: NotificacoesExtendedService,
    private readonly compliance: ComplianceService,
  ) {}

  private cronEnabled(): boolean {
    return this.config.get<string>("CRON_NOTIFICACOES_ENABLED") === "true";
  }

  /** Lembretes de sessão (amanhã) – todos os dias às 18:00 (Europe/Lisbon no host). */
  @Cron(CronExpression.EVERY_DAY_AT_6PM)
  async lembretesSessaoDiarios() {
    if (!this.cronEnabled()) return;

    const tenants = await this.activeTenants();
    for (const t of tenants) {
      try {
        const r = await this.notificacoes.enviarLembretesSessaoTenant(t.id);
        if (r.emailsEnviados > 0) {
          this.logger.log(`Lembretes sessão ${t.slug}: ${r.emailsEnviados} email(s)`);
        }
      } catch (err) {
        this.logger.warn(`Lembretes sessão falhou (${t.slug}): ${String(err)}`);
      }
    }
  }

  /** Digest alertas compliance – dias úteis às 08:00. */
  @Cron(CronExpression.MONDAY_TO_FRIDAY_AT_8AM)
  async digestAlertasSemanal() {
    if (!this.cronEnabled()) return;

    const tenants = await this.activeTenants();
    for (const t of tenants) {
      try {
        const r = await this.notificacoes.enviarDigestAlertasTenant(t.id);
        if (r.alertas > 0) {
          this.logger.log(`Digest alertas ${t.slug}: ${r.enviados} destinatário(s), ${r.alertas} alerta(s)`);
        }
      } catch (err) {
        this.logger.warn(`Digest alertas falhou (${t.slug}): ${String(err)}`);
      }
    }
  }

  /** Resumo prontidão inspeção – segunda-feira às 09:00. */
  @Cron("0 9 * * 1")
  async resumoInspecaoSemanal() {
    if (!this.cronEnabled()) return;

    const tenants = await this.activeTenants();
    for (const t of tenants) {
      try {
        const acoes = await this.prisma.acaoFormacao.findMany({
          where: { tenantId: t.id, estado: { in: ["PLANEADA", "EM_CURSO"] } },
          select: { id: true },
        });
        if (!acoes.length) continue;

        let prontas = 0;
        const alertas: string[] = [];

        for (const a of acoes) {
          const detail = await this.compliance.getByAcaoForTenant(t.id, a.id);
          if (detail.checklist.prontoInspecao) {
            prontas += 1;
          } else {
            const obrig = detail.pendencias.filter((p) => p.severidade === "obrigatorio").length;
            if (obrig > 0) {
              alertas.push(`${detail.acao.codigoInterno}: ${obrig} requisito(s) em falta`);
            }
          }
        }

        if (alertas.length === 0 && prontas === acoes.length) continue;

        await this.extended.notificarResumoInspecao(t.id, {
          totalAcoes: acoes.length,
          acoesProntas: prontas,
          alertas: alertas.slice(0, 15),
        });
      } catch (err) {
        this.logger.warn(`Resumo inspeção falhou (${t.slug}): ${String(err)}`);
      }
    }
  }

  private activeTenants() {
    return this.prisma.tenant.findMany({
      where: { status: { in: ["ACTIVE", "TRIAL"] } },
      select: { id: true, slug: true },
    });
  }
}
