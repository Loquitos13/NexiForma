import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { TeamsTranscriptService } from "./teams-transcript.service";

@Injectable()
export class TeamsTranscriptSchedulerService {
  private readonly logger = new Logger(TeamsTranscriptSchedulerService.name);

  constructor(private readonly transcripts: TeamsTranscriptService) {}

  /** Tenta importar transcrições Teams pendentes (Graph demora após fim da reunião). */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async importarPendentes() {
    try {
      const n = await this.transcripts.processarPendentes(25);
      if (n > 0) {
        this.logger.log(`Transcrições Teams importadas: ${n}.`);
      }
    } catch (err) {
      this.logger.warn(
        `Cron transcrições Teams: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
