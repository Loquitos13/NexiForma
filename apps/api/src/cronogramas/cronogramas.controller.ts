import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import type { Cronograma } from "@nexiforma/database";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { RequestUser } from "../auth/types/access-token-payload";
import { CronogramasService } from "./cronogramas.service";
import { CronogramaHtmlExportService } from "./cronograma-html-export.service";
import { CronogramaArquivoService } from "./cronograma-arquivo.service";
import {
  CronogramaImportIaService,
  type CronogramaImportJobSummary,
} from "./cronograma-import-ia.service";
import { CreateCronogramaDto } from "./dto/create-cronograma.dto";
import {
  AnalisarCronogramaIaDto,
  AplicarCronogramaIaDto,
  GuardarRascunhoImportIaDto,
} from "./dto/importar-cronograma-ia.dto";

@Controller("cronogramas")
@UseGuards(JwtAuthGuard, RolesGuard)
export class CronogramasController {
  constructor(
    private readonly cronogramas: CronogramasService,
    private readonly htmlExport: CronogramaHtmlExportService,
    private readonly arquivo: CronogramaArquivoService,
    private readonly importIa: CronogramaImportIaService,
  ) {}

  @Get()
  @Roles("tenant_manager", "coordenador_pedagogico", "formador")
  list(
    @CurrentUser() user: RequestUser,
    @Query("acaoFormacaoId", new ParseUUIDPipe({ optional: true }))
    acaoFormacaoId?: string,
  ) {
    return this.cronogramas.list(user, acaoFormacaoId);
  }

  @Get("acoes-formacao/:acaoId/arquivos")
  @Roles("tenant_manager", "coordenador_pedagogico", "formador")
  listArquivos(
    @CurrentUser() user: RequestUser,
    @Param("acaoId", ParseUUIDPipe) acaoId: string,
  ) {
    return this.arquivo.listByAcao(user, acaoId);
  }

  @Get("arquivos/:arquivoId/download")
  @Roles("tenant_manager", "coordenador_pedagogico", "formador")
  async downloadArquivo(
    @CurrentUser() user: RequestUser,
    @Param("arquivoId", ParseUUIDPipe) arquivoId: string,
    @Res() res: Response,
  ) {
    const pkg = await this.arquivo.streamArquivo(user, arquivoId);
    res.setHeader("Content-Type", pkg.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${pkg.filename}"`);
    res.send(pkg.body);
  }

  @Post()
  @Roles("tenant_manager", "coordenador_pedagogico")
  create(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateCronogramaDto,
  ): Promise<Cronograma> {
    return this.cronogramas.create(user, dto);
  }

  @Get("importar-ia/jobs")
  @Roles("tenant_manager", "coordenador_pedagogico")
  listImportIaJobs(
    @CurrentUser() user: RequestUser,
    @Query("acaoFormacaoId", new ParseUUIDPipe({ optional: true }))
    acaoFormacaoId?: string,
    @Query("cronogramaId", new ParseUUIDPipe({ optional: true }))
    cronogramaId?: string,
    @Query("ativos") ativos?: string,
  ): Promise<CronogramaImportJobSummary[]> {
    return this.importIa.listJobs(user, {
      acaoFormacaoId,
      cronogramaId,
      ativos: ativos === undefined ? undefined : ativos !== "false",
    });
  }

  @Get("importar-ia/jobs/:jobId")
  @Roles("tenant_manager", "coordenador_pedagogico")
  getImportIaJob(
    @CurrentUser() user: RequestUser,
    @Param("jobId", ParseUUIDPipe) jobId: string,
  ): Promise<CronogramaImportJobSummary> {
    return this.importIa.getJob(user, jobId);
  }

  @Post("importar-ia/jobs/:jobId/aplicar")
  @Roles("tenant_manager", "coordenador_pedagogico")
  aplicarImportIaJob(
    @CurrentUser() user: RequestUser,
    @Param("jobId", ParseUUIDPipe) jobId: string,
    @Body() dto: AplicarCronogramaIaDto,
  ) {
    return this.importIa.aplicarJob(user, jobId, dto);
  }

  @Put("importar-ia/jobs/:jobId/rascunho")
  @Roles("tenant_manager", "coordenador_pedagogico")
  guardarRascunhoImportIaJob(
    @CurrentUser() user: RequestUser,
    @Param("jobId", ParseUUIDPipe) jobId: string,
    @Body() dto: GuardarRascunhoImportIaDto,
  ): Promise<CronogramaImportJobSummary> {
    return this.importIa.guardarRascunho(user, jobId, dto);
  }

  @Post("importar-ia/jobs/:jobId/descartar")
  @Roles("tenant_manager", "coordenador_pedagogico")
  descartarImportIaJob(
    @CurrentUser() user: RequestUser,
    @Param("jobId", ParseUUIDPipe) jobId: string,
  ): Promise<CronogramaImportJobSummary> {
    return this.importIa.descartarJob(user, jobId);
  }

  @Get(":id/cronograma.html")
  @Roles("tenant_manager", "coordenador_pedagogico", "formador")
  async cronogramaHtml(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Query("download") download: string | undefined,
    @Res() res: Response,
  ) {
    const pkg = await this.htmlExport.buildPrintableHtml(user, id);
    const asAttachment = download === "1" || download === "true";
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `${asAttachment ? "attachment" : "inline"}; filename="${pkg.filename}"`,
    );
    res.send(pkg.html);
  }

  @Post(":id/arquivo")
  @Roles("tenant_manager", "coordenador_pedagogico", "formador")
  arquivarTransferivel(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.arquivo.storeTransferivel(user, id);
  }

  @Post(":id/importar-ia/analisar")
  @Roles("tenant_manager", "coordenador_pedagogico")
  analisarImportIa(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: AnalisarCronogramaIaDto,
  ): Promise<CronogramaImportJobSummary> {
    return this.importIa.analisar(user, id, dto);
  }

  @Post(":id/importar-ia/jobs")
  @Roles("tenant_manager", "coordenador_pedagogico")
  iniciarImportIaJob(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: AnalisarCronogramaIaDto,
  ): Promise<CronogramaImportJobSummary> {
    return this.importIa.iniciarJob(user, id, dto);
  }

  @Post(":id/importar-ia/aplicar")
  @Roles("tenant_manager", "coordenador_pedagogico")
  aplicarImportIa(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: AplicarCronogramaIaDto,
  ) {
    return this.importIa.aplicar(user, id, dto);
  }

  @Post(":id/importar-ia/reparar-titulos")
  @Roles("tenant_manager", "coordenador_pedagogico", "formador")
  repararTitulosImportIa(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.importIa.repararTitulosDeImportacao(user, id);
  }

  @Patch(":id/aprovar")
  @Roles("tenant_manager", "coordenador_pedagogico")
  async aprovar(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    const cronograma = await this.cronogramas.aprovar(user, id);
    const arquivo = await this.arquivo.storeTransferivel(user, id);
    return { cronograma, arquivo };
  }

  @Delete(":id")
  @Roles("tenant_manager", "coordenador_pedagogico")
  remove(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.cronogramas.remove(user, id);
  }
}
