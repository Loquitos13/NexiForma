import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { ConfigService } from "@nestjs/config";
import { ConteudosLmsService } from "./conteudos-lms.service";

/**
 * Bloqueia módulos LMS cujo limite de conclusão já passou
 * (válido até 23:59 do dia do prazo; bloqueio desde 00:00 do dia seguinte, Europe/Lisbon).
 * Activar com CRON_LMS_PRAZO_ENABLED=true (fallback: CRON_NOTIFICACOES_ENABLED).
 */
@Injectable()
export class ConteudosLmsPrazoSchedulerService {
  private readonly logger = new Logger(ConteudosLmsPrazoSchedulerService.name);
  private running = false;

  constructor(
    private readonly config: ConfigService,
    private readonly conteudos: ConteudosLmsService,
  ) {}

  private enabled(): boolean {
    const dedicated = this.config.get<string>("CRON_LMS_PRAZO_ENABLED");
    if (dedicated === "true") return true;
    if (dedicated === "false") return false;
    return this.config.get<string>("CRON_NOTIFICACOES_ENABLED") === "true";
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async processarPrazosExpirados() {
    if (!this.enabled() || this.running) return;
    this.running = true;
    try {
      const result = await this.conteudos.processarBloqueiosPorPrazo();
      if (result.bloqueados > 0) {
        this.logger.log(
          `LMS prazo: bloqueados ${result.bloqueados} módulo(s) em ${result.acoes} acção(ões).`,
        );
      }
    } catch (err) {
      this.logger.warn(`LMS prazo cron: ${String(err)}`);
    } finally {
      this.running = false;
    }
  }
}
