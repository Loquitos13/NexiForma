import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { RequestUser } from "../auth/types/access-token-payload";
import { requireTenantId } from "../common/tenant-scope";
import { DocumentAccessAuditService } from "../audit/document-access-audit.service";
import { DossieHtmlExportService } from "./dossie-html-export.service";
import { DossiePedagogicoService } from "./dossie-pedagogico.service";
import { SigoExportService } from "./sigo-export.service";
import { DossieArquivoService } from "./dossie-arquivo.service";
import { InspecaoPacoteService } from "./inspecao-pacote.service";
import { StoreExportDto } from "./dto/store-export.dto";

@Controller("dossie-pedagogico")
@UseGuards(JwtAuthGuard, RolesGuard)
export class DossiePedagogicoController {
  constructor(
    private readonly dossie: DossiePedagogicoService,
    private readonly sigo: SigoExportService,
    private readonly htmlExport: DossieHtmlExportService,
    private readonly arquivos: DossieArquivoService,
    private readonly inspecaoPacote: InspecaoPacoteService,
    private readonly documentAudit: DocumentAccessAuditService,
  ) {}

  private auditDgert(
    user: RequestUser,
    action: string,
    resourceType: string,
    resourceId: string,
    payload?: Record<string, unknown>,
  ): void {
    void this.documentAudit.logDownload({
      user,
      tenantId: requireTenantId(user),
      action,
      resourceType,
      resourceId,
      channel: "generated",
      payload,
    });
  }

  @Post("acoes-formacao/:acaoId/gerar-dossie")
  @Roles("tenant_manager", "coordenador_pedagogico")
  async gerarDossieTecnicoPedagogico(
    @CurrentUser() user: RequestUser,
    @Param("acaoId", ParseUUIDPipe) acaoId: string,
  ) {
    const result = await this.inspecaoPacote.gerarDossieTecnicoPedagogico(user, acaoId);
    this.auditDgert(user, "dgert.dossie.generate", "AcaoFormacao", acaoId);
    return result;
  }

  @Get("acoes-formacao/:acaoId/documentos-dgert")
  @Roles("tenant_manager", "coordenador_pedagogico")
  documentosDgert(
    @CurrentUser() user: RequestUser,
    @Param("acaoId", ParseUUIDPipe) acaoId: string,
  ) {
    return this.inspecaoPacote.documentosDgertStatus(user, acaoId);
  }

  @Get("acoes-formacao/:acaoId/export/pacote-inspecao.zip")
  @Roles("tenant_manager", "coordenador_pedagogico")
  async exportPacoteInspecao(
    @CurrentUser() user: RequestUser,
    @Param("acaoId", ParseUUIDPipe) acaoId: string,
    @Res() res: Response,
  ) {
    const pkg = await this.inspecaoPacote.buildZipBuffer(user, acaoId);
    this.auditDgert(user, "dgert.inspecao.export", "AcaoFormacao", acaoId, {
      filename: pkg.filename,
    });
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${pkg.filename}"`);
    res.send(pkg.buffer);
  }

  @Post("acoes-formacao/:acaoId/pacote-inspecao")
  @Roles("tenant_manager", "coordenador_pedagogico")
  async arquivarPacoteInspecao(
    @CurrentUser() user: RequestUser,
    @Param("acaoId", ParseUUIDPipe) acaoId: string,
  ) {
    const result = await this.inspecaoPacote.storePacote(user, acaoId);
    this.auditDgert(user, "dgert.inspecao.archive", "AcaoFormacao", acaoId);
    return result;
  }

  @Get("acoes-formacao/:acaoId/validacao-sigo")
  @Roles("tenant_manager", "coordenador_pedagogico")
  validacaoSigo(
    @CurrentUser() user: RequestUser,
    @Param("acaoId", ParseUUIDPipe) acaoId: string,
  ) {
    return this.sigo.validateForSigo(user, acaoId);
  }

  @Get("acoes-formacao/:acaoId/export/dossie.html")
  @Roles("tenant_manager", "coordenador_pedagogico")
  async exportDossieHtml(
    @CurrentUser() user: RequestUser,
    @Param("acaoId", ParseUUIDPipe) acaoId: string,
    @Res() res: Response,
  ) {
    const pkg = await this.htmlExport.buildPrintableHtml(user, acaoId);
    this.auditDgert(user, "dgert.dossie.html", "AcaoFormacao", acaoId, {
      filename: pkg.filename,
    });
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Content-Disposition", `inline; filename="${pkg.filename}"`);
    res.send(pkg.html);
  }

  @Get("acoes-formacao/:acaoId/export/sigo/formandos.csv")
  @Roles("tenant_manager", "coordenador_pedagogico")
  async exportSigoFormandosCsv(
    @CurrentUser() user: RequestUser,
    @Param("acaoId", ParseUUIDPipe) acaoId: string,
    @Res() res: Response,
  ) {
    const pkg = await this.sigo.buildFormandosCsv(user, acaoId);
    this.auditDgert(user, "dgert.sigo.csv", "AcaoFormacao", acaoId, {
      filename: pkg.filename,
    });
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${pkg.filename}"`);
    res.send(pkg.csv);
  }

  @Get("acoes-formacao/:acaoId/export/sigo")
  @Roles("tenant_manager", "coordenador_pedagogico")
  async exportSigoJson(
    @CurrentUser() user: RequestUser,
    @Param("acaoId", ParseUUIDPipe) acaoId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const pkg = await this.sigo.buildSigoJsonPackage(user, acaoId);
    this.auditDgert(user, "dgert.sigo.export", "AcaoFormacao", acaoId, {
      filename: pkg.filename,
    });
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${pkg.filename}"`);
    return pkg.body;
  }

  @Get("acoes-formacao/:acaoId/export")
  @Roles("tenant_manager", "coordenador_pedagogico")
  async exportJson(
    @CurrentUser() user: RequestUser,
    @Param("acaoId", ParseUUIDPipe) acaoId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const pkg = await this.dossie.buildExportPackage(user, acaoId);
    this.auditDgert(user, "dgert.dossie.export", "AcaoFormacao", acaoId, {
      filename: pkg.filename,
    });
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${pkg.filename}"`);
    return pkg.body;
  }

  @Get("acoes-formacao/:acaoId")
  @Roles("tenant_manager", "coordenador_pedagogico")
  getByAcao(
    @CurrentUser() user: RequestUser,
    @Param("acaoId", ParseUUIDPipe) acaoId: string,
  ) {
    return this.dossie.getByAcaoFormacao(user, acaoId);
  }

  @Get("acoes-formacao/:acaoId/arquivos")
  @Roles("tenant_manager", "coordenador_pedagogico")
  listArquivos(
    @CurrentUser() user: RequestUser,
    @Param("acaoId", ParseUUIDPipe) acaoId: string,
  ) {
    return this.arquivos.listByAcao(user, acaoId);
  }

  @Post("acoes-formacao/:acaoId/arquivos")
  @Roles("tenant_manager", "coordenador_pedagogico")
  async storeArquivo(
    @CurrentUser() user: RequestUser,
    @Param("acaoId", ParseUUIDPipe) acaoId: string,
    @Body() dto: StoreExportDto,
  ) {
    const result = await this.arquivos.storeExport(user, acaoId, dto.tipo);
    this.auditDgert(user, "dgert.arquivo.store", "AcaoFormacao", acaoId, {
      tipo: dto.tipo,
    });
    return result;
  }

  @Get("arquivos/:arquivoId/url")
  @Roles("tenant_manager", "coordenador_pedagogico")
  async arquivoUrl(
    @CurrentUser() user: RequestUser,
    @Param("arquivoId", ParseUUIDPipe) arquivoId: string,
  ) {
    const result = await this.arquivos.getDownloadUrl(user, arquivoId);
    this.auditDgert(user, "dgert.arquivo.download", "ArquivoExportacao", arquivoId, {
      nomeFicheiro: result.nomeFicheiro,
    });
    return result;
  }
}
