import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { RequestUser } from "../auth/types/access-token-payload";
import { requireTenantId } from "../common/tenant-scope";
import type { ModuloConteudo, ModuloUnidade, ProgressoModulo } from "@nexiforma/database";
import {
  CreateModuloConteudoDto,
  CreateModuloUnidadeDto,
  DesbloquearUnidadeDto,
  UpdateModuloPrazoAcaoDto,
  UpdateModuloTarefasAcaoDto,
  UpdateModuloUnidadeDto,
  UpdateProgressoModuloDto,
} from "./dto/conteudos-lms.dto";
import { ScormCmiCommitDto } from "./dto/scorm.dto";
import { ConteudosLmsService } from "./conteudos-lms.service";
import { ScormService } from "./scorm.service";
import { ScormPackageService } from "./scorm-package.service";
import { ScormAssetAuthService } from "./scorm-asset-auth.service";

@Controller("conteudos-lms")
@UseGuards(JwtAuthGuard, RolesGuard)
export class ConteudosLmsController {
  constructor(
    private readonly conteudos: ConteudosLmsService,
    private readonly scorm: ScormService,
    private readonly scormPackages: ScormPackageService,
    private readonly scormAssetAuth: ScormAssetAuthService,
  ) {}

  @Get("unidades")
  @Roles("tenant_manager", "coordenador_pedagogico", "formador", "formando")
  listUnidades(@CurrentUser() user: RequestUser, @Query("cursoId") cursoId: string) {
    return this.conteudos.listUnidades(user, cursoId);
  }

  @Post("unidades")
  @Roles("tenant_manager", "coordenador_pedagogico", "formador")
  createUnidade(@CurrentUser() user: RequestUser, @Body() dto: CreateModuloUnidadeDto): Promise<ModuloUnidade> {
    return this.conteudos.createUnidade(user, dto);
  }

  @Post("unidades/sync-prerequisitos")
  @Roles("tenant_manager", "coordenador_pedagogico", "formador")
  @HttpCode(204)
  async syncPrerequisitos(
    @CurrentUser() user: RequestUser,
    @Query("cursoId") cursoId: string,
  ): Promise<void> {
    if (!cursoId?.trim()) throw new BadRequestException("cursoId é obrigatório.");
    await this.conteudos.syncPrerequisitosSequenciais(user, cursoId.trim());
  }

  @Patch("unidades/:id")
  @Roles("tenant_manager", "coordenador_pedagogico", "formador")
  updateUnidade(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateModuloUnidadeDto,
  ): Promise<ModuloUnidade> {
    return this.conteudos.updateUnidade(user, id, dto);
  }

  @Delete("unidades/:id")
  @Roles("tenant_manager", "coordenador_pedagogico", "formador")
  @HttpCode(204)
  async deleteUnidade(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.conteudos.deleteUnidade(user, id);
  }

  @Get("modulos")
  @Roles("tenant_manager", "coordenador_pedagogico", "formador", "formando")
  listModulos(@CurrentUser() user: RequestUser, @Query("cursoId") cursoId: string): Promise<ModuloConteudo[]> {
    return this.conteudos.listModulos(user, cursoId);
  }

  @Post("modulos")
  @Roles("tenant_manager", "coordenador_pedagogico", "formador")
  createModulo(@CurrentUser() user: RequestUser, @Body() dto: CreateModuloConteudoDto): Promise<ModuloConteudo> {
    return this.conteudos.createModulo(user, dto);
  }

  @Patch("modulos/:id")
  @Roles("tenant_manager", "coordenador_pedagogico", "formador")
  updateModulo(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: Partial<CreateModuloConteudoDto>,
  ): Promise<ModuloConteudo> {
    return this.conteudos.updateModulo(user, id, dto);
  }

  @Delete("modulos/:id")
  @Roles("tenant_manager", "coordenador_pedagogico", "formador")
  @HttpCode(204)
  async deleteModulo(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.conteudos.deleteModulo(user, id);
  }

  @Post("matriculas/:matriculaId/unidades/:unidadeId/desbloquear")
  @Roles("formando", "tenant_manager", "formador")
  desbloquearUnidade(
    @CurrentUser() user: RequestUser,
    @Param("matriculaId", ParseUUIDPipe) matriculaId: string,
    @Param("unidadeId", ParseUUIDPipe) unidadeId: string,
    @Body() dto: DesbloquearUnidadeDto,
  ) {
    return this.conteudos.desbloquearUnidadeMatricula(user, matriculaId, unidadeId, dto.motivo);
  }

  @Delete("matriculas/:matriculaId/unidades/:unidadeId/desbloquear")
  @Roles("tenant_manager", "coordenador_pedagogico")
  @HttpCode(204)
  async bloquearUnidade(
    @CurrentUser() user: RequestUser,
    @Param("matriculaId", ParseUUIDPipe) matriculaId: string,
    @Param("unidadeId", ParseUUIDPipe) unidadeId: string,
  ): Promise<void> {
    await this.conteudos.bloquearUnidadeMatricula(user, matriculaId, unidadeId);
  }

  @Get("percurso")
  @Roles("formando", "tenant_manager", "formador")
  percurso(
    @CurrentUser() user: RequestUser,
    @Query("cursoId") cursoId: string,
    @Query("matriculaId") matriculaId: string,
  ) {
    return this.conteudos.getPercursoFormando(user, cursoId, matriculaId);
  }

  @Get("progresso")
  @Roles("tenant_manager", "coordenador_pedagogico", "formador", "formando")
  progresso(
    @CurrentUser() user: RequestUser,
    @Query("matriculaId") matriculaId: string,
  ): Promise<
    (ProgressoModulo & {
      modulo: { id: string; titulo: string; tipo: string; ordem: number };
    })[]
  > {
    return this.conteudos.listProgresso(user, matriculaId);
  }

  @Get("acoes/:acaoId/libertar")
  @Roles("formador", "tenant_manager")
  estadoLibertarAcao(
    @CurrentUser() user: RequestUser,
    @Param("acaoId", ParseUUIDPipe) acaoId: string,
  ) {
    return this.conteudos.estadoLibertarAcao(user, acaoId);
  }

  @Put("acoes/:acaoId/modulos/:unidadeId/tarefas")
  @Roles("formador", "tenant_manager")
  setModuloTarefas(
    @CurrentUser() user: RequestUser,
    @Param("acaoId", ParseUUIDPipe) acaoId: string,
    @Param("unidadeId", ParseUUIDPipe) unidadeId: string,
    @Body() body: UpdateModuloTarefasAcaoDto,
  ) {
    return this.conteudos.setModuloTarefasAcao(
      user,
      acaoId,
      unidadeId,
      body.desbloqueado === true,
    );
  }

  @Put("acoes/:acaoId/modulos/:unidadeId/prazo")
  @Roles("tenant_manager", "coordenador_pedagogico")
  setModuloPrazo(
    @CurrentUser() user: RequestUser,
    @Param("acaoId", ParseUUIDPipe) acaoId: string,
    @Param("unidadeId", ParseUUIDPipe) unidadeId: string,
    @Body() body: UpdateModuloPrazoAcaoDto,
  ) {
    return this.conteudos.setModuloPrazoAcao(user, acaoId, unidadeId, body.prazoConclusao);
  }

  @Get("formador/progresso-resumo")
  @Roles("formador", "tenant_manager")
  resumoProgressoFormador(@CurrentUser() user: RequestUser) {
    return this.conteudos.resumoProgressoFormador(user);
  }

  @Get("formador/progresso-detalhe")
  @Roles("formador", "tenant_manager")
  progressoDetalheFormador(
    @CurrentUser() user: RequestUser,
    @Query("matriculaId", ParseUUIDPipe) matriculaId: string,
  ) {
    return this.conteudos.progressoDetalheFormador(user, matriculaId);
  }

  @Patch("progresso/:moduloId")
  @Roles("formando", "tenant_manager", "formador")
  updateProgresso(
    @CurrentUser() user: RequestUser,
    @Param("moduloId") moduloId: string,
    @Query("matriculaId") matriculaId: string,
    @Body() dto: UpdateProgressoModuloDto,
  ): Promise<ProgressoModulo> {
    return this.conteudos.updateProgresso(user, matriculaId, moduloId, dto);
  }

  @Get("scorm/:moduloId/launch")
  @Roles("formando", "tenant_manager", "formador")
  scormLaunch(
    @CurrentUser() user: RequestUser,
    @Param("moduloId") moduloId: string,
    @Query("matriculaId") matriculaId: string,
  ) {
    return this.scorm.getLaunchContext(user, moduloId, matriculaId);
  }

  @Post("scorm/:moduloId/cmi")
  @Roles("formando", "tenant_manager", "formador")
  scormCommit(
    @CurrentUser() user: RequestUser,
    @Param("moduloId") moduloId: string,
    @Query("matriculaId") matriculaId: string,
    @Body() dto: ScormCmiCommitDto,
  ): Promise<ProgressoModulo> {
    return this.scorm.commitCmi(user, moduloId, matriculaId, dto.cmi);
  }

  @Post("modulos/upload-novo")
  @Roles("tenant_manager", "coordenador_pedagogico", "formador")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 200 * 1024 * 1024 } }))
  uploadNovoModuloComFicheiro(
    @CurrentUser() user: RequestUser,
    @UploadedFile() file: Express.Multer.File,
    @Body("cursoId") cursoId: string,
    @Body("moduloUnidadeId") moduloUnidadeId: string,
  ): Promise<ModuloConteudo> {
    if (!file) throw new BadRequestException("Ficheiro em falta.");
    if (!cursoId?.trim() || !moduloUnidadeId?.trim()) {
      throw new BadRequestException("cursoId e moduloUnidadeId são obrigatórios.");
    }
    return this.conteudos.uploadNovoModuloComFicheiro(user, cursoId.trim(), moduloUnidadeId.trim(), file);
  }

  @Post("modulos/:id/upload")
  @Roles("tenant_manager", "coordenador_pedagogico", "formador")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 200 * 1024 * 1024 } }))
  uploadModuloFicheiro(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<ModuloConteudo> {
    if (!file) throw new BadRequestException("Ficheiro em falta.");
    return this.conteudos.uploadModuloFicheiro(user, id, file);
  }

  @Get("modulos/:id/media")
  @Roles("tenant_manager", "coordenador_pedagogico", "formador", "formando")
  async serveModuloMedia(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const media = await this.conteudos.getModuloMedia(user, id);
    res.setHeader("Content-Type", media.contentType);
    res.setHeader("Cache-Control", "private, max-age=300");
    if (media.fileName) {
      res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(media.fileName)}"`);
    }
    res.send(media.body);
  }

  @Post("scorm/upload")
  @Roles("tenant_manager", "coordenador_pedagogico", "formador")
  @UseInterceptors(
    FileInterceptor("package", { limits: { fileSize: 50 * 1024 * 1024 } }),
  )
  uploadScorm(
    @CurrentUser() user: RequestUser,
    @UploadedFile() file: Express.Multer.File,
    @Body("cursoId") cursoId: string,
    @Body("titulo") titulo: string,
  ): Promise<ModuloConteudo> {
    return this.scormPackages.uploadPackage(user, cursoId, titulo, file);
  }

  @Post("scorm/:moduloId/asset-session")
  @HttpCode(204)
  @Roles("formando", "tenant_manager", "formador")
  async openScormAssetSession(
    @CurrentUser() user: RequestUser,
    @Param("moduloId") moduloId: string,
    @Query("matriculaId") matriculaId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tenantId = requireTenantId(user);
    await this.scormAssetAuth.openAssetSession(moduloId, matriculaId, tenantId, res);
  }
}
