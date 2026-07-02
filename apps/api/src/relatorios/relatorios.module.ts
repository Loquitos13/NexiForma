import { Module } from "@nestjs/common";
import { BillingModule } from "../billing/billing.module";
import { RelatoriosController } from "./relatorios.controller";
import { RelatoriosService } from "./relatorios.service";
import { RelatoriosDashboardService } from "./relatorios-dashboard.service";
import { RelatoriosInsightsService } from "./relatorios-insights.service";
import { RelatoriosExportService } from "./relatorios-export.service";

@Module({
  imports: [BillingModule],
  controllers: [RelatoriosController],
  providers: [
    RelatoriosService,
    RelatoriosDashboardService,
    RelatoriosInsightsService,
    RelatoriosExportService,
  ],
})
export class RelatoriosModule {}
