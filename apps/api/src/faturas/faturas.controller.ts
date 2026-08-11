import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
  BadRequestException,
} from "@nestjs/common";
import type { Response } from "express";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { RequestUser } from "../auth/types/access-token-payload";
import { requireTenantId } from "../common/tenant-scope";
import { DocumentAccessAuditService } from "../audit/document-access-audit.service";
import { FaturasService } from "./faturas.service";
import {
  AnularFaturaDto,
  CreateFaturaDto,
  EnviarFaturaEmailDto,
  RejeitarPedidoAnulacaoDto,
  UpdateConfigFaturacaoDto,
  UpdateFaturaDto,
  UpdateSerieFaturacaoDto,
} from "./dto/fatura.dto";

@Controller("crm")
@UseGuards(JwtAuthGuard, RolesGuard)
export class FaturasController {
  constructor(
    private readonly faturas: FaturasService,
    private readonly documentAudit: DocumentAccessAuditService,
  ) {}

  @Get("faturas")
  @Roles("tenant_manager", "coordenador_financeiro")
  list(
    @CurrentUser() user: RequestUser,
    @Query("entidadeClienteId") entidadeClienteId?: string,
    @Query("estado") estado?: string,
    @Query("q") q?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ): Promise<unknown> {
    return this.faturas.list(user, { entidadeClienteId, estado, q, page, pageSize });
  }

  @Get("faturas/dashboard-financeiro")
  @Roles("tenant_manager", "coordenador_financeiro")
  getDashboardFinanceiro(@CurrentUser() user: RequestUser): Promise<unknown> {
    return this.faturas.getDashboardFinanceiro(user);
  }

  @Get("faturas/export/saft")
  @Roles("tenant_manager", "coordenador_financeiro")
  async exportSaft(
    @CurrentUser() user: RequestUser,
    @Query("ano") ano: string,
    @Query("mes") mes: string | undefined,
    @Res() res: Response,
  ) {
    const year = parseInt(ano, 10);
    if (!Number.isFinite(year) || year < 2000 || year > 2100) {
      throw new BadRequestException("Parâmetro ano inválido.");
    }
    const month = mes ? parseInt(mes, 10) : undefined;
    if (month !== undefined && (month < 1 || month > 12)) {
      throw new BadRequestException("Parâmetro mes inválido (1-12).");
    }
    const pkg = await this.faturas.exportSaftPt(user, { ano: year, mes: month });
    await this.documentAudit.logDownload({
      user,
      tenantId: requireTenantId(user),
      action: "saft.export",
      resourceType: "SaftExport",
      resourceId: `${year}${month != null ? `-${month}` : ""}`,
      channel: "generated",
      payload: { ano: year, mes: month ?? null, filename: pkg.filename },
    });
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${pkg.filename}"`);
    res.send(pkg.xml);
  }

  @Get("faturas/export/auditoria.zip")
  @Roles("tenant_manager", "coordenador_financeiro")
  async exportAuditoria(
    @CurrentUser() user: RequestUser,
    @Query("ano") ano: string,
    @Query("mes") mes: string | undefined,
    @Res() res: Response,
  ) {
    const year = parseInt(ano, 10);
    if (!Number.isFinite(year) || year < 2000 || year > 2100) {
      throw new BadRequestException("Parâmetro ano inválido.");
    }
    const month = mes ? parseInt(mes, 10) : undefined;
    if (month !== undefined && (month < 1 || month > 12)) {
      throw new BadRequestException("Parâmetro mes inválido (1-12).");
    }
    const pkg = await this.faturas.exportAuditoriaFaturacao(user, {
      ano: year,
      mes: month,
    });
    await this.documentAudit.logDownload({
      user,
      tenantId: requireTenantId(user),
      action: "faturacao.auditoria.export",
      resourceType: "FaturacaoAuditoriaPack",
      resourceId: `${year}${month != null ? `-${month}` : ""}`,
      channel: "generated",
      payload: {
        ano: year,
        mes: month ?? null,
        filename: pkg.filename,
        faturas: pkg.faturas,
      },
    });
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${pkg.filename}"`);
    res.send(pkg.buffer);
  }

  @Get("faturas/:id/documento.html")
  @Roles("tenant_manager", "coordenador_financeiro")
  async documentoHtml(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Query("download") download: string | undefined,
    @Res() res: Response,
  ) {
    const pkg = await this.faturas.buildDocumentoHtml(user, id);
    const asAttachment = download === "1" || download === "true";
    await this.documentAudit.logDownload({
      user,
      tenantId: requireTenantId(user),
      action: "fatura.download",
      resourceType: "Fatura",
      resourceId: id,
      channel: "generated",
      payload: { format: "html", asAttachment, filename: pkg.filename },
    });
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `${asAttachment ? "attachment" : "inline"}; filename="${pkg.filename}"`,
    );
    res.send(pkg.html);
  }

  @Get("faturas/:id/documento.pdf")
  @Roles("tenant_manager", "coordenador_financeiro")
  async documentoPdf(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Query("download") download: string | undefined,
    @Res() res: Response,
  ) {
    const pkg = await this.faturas.buildDocumentoPdf(user, id);
    const asAttachment = download === "1" || download === "true";
    await this.documentAudit.logDownload({
      user,
      tenantId: requireTenantId(user),
      action: "fatura.download",
      resourceType: "Fatura",
      resourceId: id,
      channel: "generated",
      payload: { format: "pdf", asAttachment, filename: pkg.filename },
    });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `${asAttachment ? "attachment" : "inline"}; filename="${pkg.filename}"`,
    );
    res.send(pkg.pdf);
  }

  @Get("faturas/:id")
  @Roles("tenant_manager", "coordenador_financeiro")
  detail(@CurrentUser() user: RequestUser, @Param("id", ParseUUIDPipe) id: string): Promise<unknown> {
    return this.faturas.getOne(user, id);
  }

  @Post("faturas")
  @Roles("tenant_manager", "coordenador_financeiro")
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateFaturaDto): Promise<unknown> {
    return this.faturas.create(user, dto);
  }

  @Patch("faturas/:id")
  @Roles("tenant_manager", "coordenador_financeiro")
  update(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateFaturaDto,
  ): Promise<unknown> {
    return this.faturas.update(user, id, dto);
  }

  @Post("faturas/:id/emitir")
  @Roles("tenant_manager", "coordenador_financeiro")
  emitir(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<unknown> {
    return this.faturas.emitir(user, id);
  }

  @Post("faturas/:id/comunicar-at")
  @Roles("tenant_manager", "coordenador_financeiro")
  comunicarAt(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<unknown> {
    return this.faturas.comunicarAt(user, id);
  }

  @Post("faturas/:id/reenviar-at")
  @Roles("tenant_manager", "coordenador_financeiro")
  reenviarAt(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<unknown> {
    return this.faturas.reenviarAt(user, id);
  }

  @Post("faturas/:id/enviar-email")
  @Roles("tenant_manager", "coordenador_financeiro")
  enviarEmail(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: EnviarFaturaEmailDto,
  ): Promise<unknown> {
    return this.faturas.enviarEmail(user, id, dto);
  }

  @Post("faturas/:id/anular")
  @Roles("tenant_manager", "coordenador_financeiro")
  anular(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: AnularFaturaDto,
  ): Promise<unknown> {
    return this.faturas.anular(user, id, dto);
  }

  @Post("faturas/:id/rejeitar-pedido-anulacao")
  @Roles("tenant_manager", "coordenador_financeiro")
  rejeitarPedidoAnulacao(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: RejeitarPedidoAnulacaoDto,
  ): Promise<unknown> {
    return this.faturas.rejeitarPedidoAnulacao(user, id, dto);
  }

  @Post("propostas/:propostaId/faturar")
  @Roles("tenant_manager", "coordenador_financeiro")
  faturarProposta(
    @CurrentUser() user: RequestUser,
    @Param("propostaId", ParseUUIDPipe) propostaId: string,
  ): Promise<unknown> {
    return this.faturas.createFromProposta(user, propostaId);
  }

  @Post("faturas/:id/nota-credito")
  @Roles("tenant_manager", "coordenador_financeiro")
  criarNotaCredito(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<unknown> {
    return this.faturas.criarNotaCredito(user, id);
  }

  @Post("config/faturacao/testar-at")
  @Roles("tenant_manager", "coordenador_financeiro")
  testarLigacaoAt(@CurrentUser() user: RequestUser): Promise<unknown> {
    return this.faturas.testarLigacaoAt(user);
  }

  @Get("config/faturacao/certificacao")
  @Roles("tenant_manager", "coordenador_financeiro")
  certificacaoStatus(@CurrentUser() user: RequestUser): Promise<unknown> {
    return this.faturas.getCertificacaoStatus(user);
  }

  @Patch("config/faturacao/series/:serieId")
  @Roles("tenant_manager", "coordenador_financeiro")
  updateSerie(
    @CurrentUser() user: RequestUser,
    @Param("serieId", ParseUUIDPipe) serieId: string,
    @Body() dto: UpdateSerieFaturacaoDto,
  ): Promise<unknown> {
    return this.faturas.updateSerie(user, serieId, dto);
  }

  @Post("config/faturacao/series/:serieId/comunicar-at")
  @Roles("tenant_manager", "coordenador_financeiro")
  comunicarSerieAt(
    @CurrentUser() user: RequestUser,
    @Param("serieId", ParseUUIDPipe) serieId: string,
  ): Promise<unknown> {
    return this.faturas.comunicarSerieAt(user, serieId);
  }

  @Post("config/faturacao/series/comunicar-todas")
  @Roles("tenant_manager", "coordenador_financeiro")
  comunicarTodasSeriesAt(@CurrentUser() user: RequestUser): Promise<unknown> {
    return this.faturas.comunicarTodasSeriesAt(user);
  }

  @Get("config/faturacao")
  @Roles("tenant_manager", "coordenador_financeiro")
  getConfig(@CurrentUser() user: RequestUser): Promise<unknown> {
    return this.faturas.getConfig(user);
  }

  @Patch("config/faturacao")
  @Roles("tenant_manager", "coordenador_financeiro")
  updateConfig(
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateConfigFaturacaoDto,
  ): Promise<unknown> {
    return this.faturas.updateConfig(user, dto);
  }
}
