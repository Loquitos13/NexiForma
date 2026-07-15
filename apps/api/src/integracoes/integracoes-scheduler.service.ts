import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { IntegracoesService } from "./integracoes.service";

@Injectable()
export class IntegracoesSchedulerService {
  private readonly logger = new Logger(IntegracoesSchedulerService.name);

  constructor(private readonly integracoes: IntegracoesService) {}

  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async salasAutomaticas() {
    try {
      const res = await this.integracoes.criarSalasPendentesAutomaticamente();
      if (res.criadas > 0 || res.erros > 0) {
        this.logger.log(`Salas auto: ${res.criadas} criada(s), ${res.erros} erro(s).`);
      }
    } catch (err) {
      this.logger.warn(`Salas automáticas: ${String(err)}`);
    }
  }
}
