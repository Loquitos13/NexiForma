import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { ConfigService } from "@nestjs/config";
import { CalendarioNotificacoesService } from "./calendario-notificacoes.service";

@Injectable()
export class CalendarioSchedulerService {
  private readonly logger = new Logger(CalendarioSchedulerService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly calendario: CalendarioNotificacoesService,
  ) {}

  private enabled(): boolean {
    return this.config.get<string>("CRON_NOTIFICACOES_ENABLED") === "true";
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async lembretesCalendario() {
    if (!this.enabled()) return;
    try {
      await this.calendario.processarLembretesPendentes();
    } catch (err) {
      this.logger.warn(`Lembretes calendário: ${String(err)}`);
    }
  }
}
