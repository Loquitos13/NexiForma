import { Body, Controller, Get, Post, Res, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Response } from "express";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { RequestUser } from "../auth/types/access-token-payload";
import type { RelatorioInsightsRequest } from "@nexiforma/shared";
import { requireTenantId } from "../common/tenant-scope";
import { BillingEntitlementsService } from "../billing/billing-entitlements.service";
import { RelatoriosService } from "./relatorios.service";
import { RelatoriosDashboardService } from "./relatorios-dashboard.service";
import { RelatoriosInsightsService } from "./relatorios-insights.service";
import { RelatoriosExportService } from "./relatorios-export.service";

@Controller("relatorios")
@UseGuards(JwtAuthGuard, RolesGuard)
export class RelatoriosController {
  constructor(
    private readonly relatorios: RelatoriosService,
    private readonly dashboard: RelatoriosDashboardService,
    private readonly insights: RelatoriosInsightsService,
    private readonly exportPdf: RelatoriosExportService,
    private readonly entitlements: BillingEntitlementsService,
  ) {}

  @Get("dashboard")
  @Roles("tenant_manager")
  async dashboardReport(@CurrentUser() user: RequestUser) {
    await this.entitlements.assertRelatoriosDashboard(requireTenantId(user));
    return this.dashboard.dashboard(user);
  }

  @Post("insights")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Roles("tenant_manager")
  async insightsReport(@Body() dto: RelatorioInsightsRequest, @CurrentUser() user: RequestUser) {
    await this.entitlements.assertRelatoriosInsights(requireTenantId(user));
    const data = await this.dashboard.dashboard(user);
    return this.insights.gerar(dto, data);
  }

  @Post("insights/pdf")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Roles("tenant_manager")
  async insightsPdf(
    @Body() dto: RelatorioInsightsRequest,
    @CurrentUser() user: RequestUser,
    @Res() res: Response,
  ) {
    await this.entitlements.assertRelatoriosInsights(requireTenantId(user));
    const pkg = await this.exportPdf.gerarPdf(user, dto);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${pkg.filename}"`);
    res.send(pkg.buffer);
  }

  @Get("executivo")
  @Roles("tenant_manager")
  async executivo(@CurrentUser() user: RequestUser) {
    await this.entitlements.assertRelatoriosDashboard(requireTenantId(user));
    return this.relatorios.executivo(user);
  }

  @Get("inspecao")
  @Roles("tenant_manager")
  async inspecao(@CurrentUser() user: RequestUser) {
    await this.entitlements.assertRelatoriosDashboard(requireTenantId(user));
    return this.relatorios.inspecao(user);
  }
}
