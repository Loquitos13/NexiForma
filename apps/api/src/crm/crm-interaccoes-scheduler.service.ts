import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { CrmInteraccoesService } from "./crm-interaccoes.service";

@Injectable()
export class CrmInteraccoesSchedulerService {
  private readonly logger = new Logger(CrmInteraccoesSchedulerService.name);

  constructor(private readonly interaccoes: CrmInteraccoesService) {}

  /** Processa notas pendentes (backup se o processamento imediato falhar). */
  @Cron(CronExpression.EVERY_MINUTE)
  async processarNotasPendentes() {
    try {
      const n = await this.interaccoes.processarPendentes(15);
      if (n > 0) {
        this.logger.log(`Processadas ${n} interacção(ões) comercial(is) pendentes.`);
      }
    } catch (err) {
      this.logger.warn(
        `Cron interacções CRM: ${err instanceof Error ? err.message : "erro"}`,
      );
    }
  }
}
