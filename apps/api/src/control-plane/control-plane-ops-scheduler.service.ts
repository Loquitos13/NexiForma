import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { ConfigService } from "@nestjs/config";
import { ControlPlaneOpsService } from "./control-plane-ops.service";

@Injectable()
export class ControlPlaneOpsSchedulerService {
  private readonly logger = new Logger(ControlPlaneOpsSchedulerService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly ops: ControlPlaneOpsService,
  ) {}

  private enabled(): boolean {
    return this.config.get<string>("PLATFORM_OPS_CRON_ENABLED") === "true";
  }

  /** Health checks de todos os tenants activos - a cada 15 minutos. */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async tenantHealthChecks() {
    if (!this.enabled()) return;
    try {
      const r = await this.ops.runHealthChecks();
      this.logger.log(`Health checks: ${r.checked} tenant(s)`);
    } catch (err) {
      this.logger.warn(`Health checks falharam: ${String(err)}`);
    }
  }
}
