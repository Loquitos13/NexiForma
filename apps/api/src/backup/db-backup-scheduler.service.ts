import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { DbBackupService } from "./db-backup.service";

@Injectable()
export class DbBackupSchedulerService {
  private readonly logger = new Logger(DbBackupSchedulerService.name);

  constructor(private readonly backups: DbBackupService) {}

  /** Backup de segurança da BD a cada 12 horas (00:00 e 12:00 UTC do cron Nest). */
  @Cron("0 0 */12 * * *")
  async everyTwelveHours() {
    const result = await this.backups.runScheduledBackup();
    if (result.skipped) {
      this.logger.debug(`DB backup skipped: ${result.reason}`);
      return;
    }
    if (!result.ok) {
      this.logger.warn(`DB backup falhou: ${result.reason}`);
      return;
    }
    this.logger.log(`DB backup agendado OK: ${result.key}`);
  }
}
