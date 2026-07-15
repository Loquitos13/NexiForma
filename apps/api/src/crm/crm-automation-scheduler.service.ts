import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { CrmAutomationService } from "./crm-automation.service";
import { CrmEmailSyncService } from "./crm-email-sync.service";

@Injectable()
export class CrmAutomationSchedulerService {
  private readonly logger = new Logger(CrmAutomationSchedulerService.name);

  constructor(
    private readonly automation: CrmAutomationService,
    private readonly emailSync: CrmEmailSyncService,
  ) {}

  /** Leads sem actividade - dispara regras LEAD_STALE. */
  @Cron(CronExpression.EVERY_HOUR)
  async processarLeadsParados() {
    try {
      const n = await this.automation.processStaleLeads();
      if (n > 0) {
        this.logger.log(`Automações LEAD_STALE: ${n} acção(ões).`);
      }
    } catch (err) {
      this.logger.warn(`Cron LEAD_STALE: ${err instanceof Error ? err.message : "erro"}`);
    }
  }

  /** Sincronização email Gmail/M365 (stub OAuth - regista última tentativa). */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async sincronizarEmail() {
    try {
      const n = await this.emailSync.syncAllTenants();
      if (n > 0) {
        this.logger.log(`Email sync: ${n} tenant(s) processado(s).`);
      }
    } catch (err) {
      this.logger.warn(`Cron email sync: ${err instanceof Error ? err.message : "erro"}`);
    }
  }
}
