import { Injectable } from "@nestjs/common";
import type { RelatorioInsightsRequest } from "@nexiforma/shared";
import type { RequestUser } from "../auth/types/access-token-payload";
import { HtmlPdfExportService } from "../common/html-pdf-export.service";
import { resolveTenantLogoDataUri } from "../common/tenant-logo-embed.util";
import { requireTenantId } from "../common/tenant-scope";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { buildRelatorioPdfHtml } from "./relatorio-html.util";
import { RelatoriosDashboardService } from "./relatorios-dashboard.service";
import { RelatoriosInsightsService } from "./relatorios-insights.service";

@Injectable()
export class RelatoriosExportService {
  constructor(
    private readonly dashboard: RelatoriosDashboardService,
    private readonly insights: RelatoriosInsightsService,
    private readonly htmlPdf: HtmlPdfExportService,
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async gerarPdf(user: RequestUser, dto: RelatorioInsightsRequest) {
    const tenantId = requireTenantId(user);
    const [dash, tenant] = await Promise.all([
      this.dashboard.dashboard(user),
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { legalName: true, metadata: true },
      }),
    ]);
    const [analise, logoSrc] = await Promise.all([
      this.insights.gerar({ ...dto, modoPdf: true }, dash),
      resolveTenantLogoDataUri(this.storage, tenant?.metadata),
    ]);
    const html = buildRelatorioPdfHtml({
      secao: dto.secao,
      tenantNome: tenant?.legalName ?? "Organização",
      dashboard: dash,
      insights: analise,
      logoSrc,
    });
    const buffer = await this.htmlPdf.htmlToPdfBuffer(html);
    const stamp = new Date().toISOString().slice(0, 10);
    return {
      buffer,
      filename: `relatorio-${dto.secao}-${stamp}.pdf`,
    };
  }
}
