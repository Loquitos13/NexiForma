import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { RequestUser } from "../auth/types/access-token-payload";
import { FormacoesService } from "./formacoes.service";
import {
  CreateFormacaoAcaoDto,
  CreateFormacaoDto,
  UpdateFormacaoAcaoDto,
  UpdateFormacaoDto,
} from "./dto/formacoes.dto";
import { PublicarFormacaoDto } from "./dto/website-sync.dto";

/**
 * Catálogo de formações para gestão interna e sync com website do tenant.
 */
@Controller("formacoes")
@UseGuards(JwtAuthGuard, RolesGuard)
export class FormacoesController {
  constructor(private readonly formacoes: FormacoesService) {}

  @Get()
  @Roles("tenant_manager", "formador")
  list(@CurrentUser() user: RequestUser) {
    return this.formacoes.list(user);
  }

  @Post()
  @Roles("tenant_manager")
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateFormacaoDto) {
    return this.formacoes.create(user, dto);
  }

  @Get(":cursoId")
  @Roles("tenant_manager", "formador")
  detail(
    @CurrentUser() user: RequestUser,
    @Param("cursoId", ParseUUIDPipe) cursoId: string,
  ) {
    return this.formacoes.getOne(user, cursoId);
  }

  @Patch(":cursoId")
  @Roles("tenant_manager")
  update(
    @CurrentUser() user: RequestUser,
    @Param("cursoId", ParseUUIDPipe) cursoId: string,
    @Body() dto: UpdateFormacaoDto,
  ) {
    return this.formacoes.update(user, cursoId, dto);
  }

  @Delete(":cursoId")
  @Roles("tenant_manager")
  remove(@CurrentUser() user: RequestUser, @Param("cursoId", ParseUUIDPipe) cursoId: string) {
    return this.formacoes.remove(user, cursoId);
  }

  @Post(":cursoId/publicar")
  @Roles("tenant_manager")
  publicar(
    @CurrentUser() user: RequestUser,
    @Param("cursoId", ParseUUIDPipe) cursoId: string,
    @Body() dto: PublicarFormacaoDto,
  ) {
    return this.formacoes.setPublicado(user, cursoId, dto.publicado);
  }

  @Post(":cursoId/capa")
  @Roles("tenant_manager")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 5 * 1024 * 1024 } }))
  uploadCapa(
    @CurrentUser() user: RequestUser,
    @Param("cursoId", ParseUUIDPipe) cursoId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.formacoes.uploadCapa(user, cursoId, file);
  }

  @Get(":cursoId/capa")
  @Roles("tenant_manager", "formador")
  async streamCapa(
    @CurrentUser() user: RequestUser,
    @Param("cursoId", ParseUUIDPipe) cursoId: string,
    @Res() res: Response,
  ) {
    const obj = await this.formacoes.streamCapa(user, cursoId);
    res.setHeader("Content-Type", obj.contentType);
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.send(obj.body);
  }

  @Get(":cursoId/acoes")
  @Roles("tenant_manager", "formador")
  listAcoes(
    @CurrentUser() user: RequestUser,
    @Param("cursoId", ParseUUIDPipe) cursoId: string,
  ) {
    return this.formacoes.listAcoes(user, cursoId);
  }

  @Post(":cursoId/acoes")
  @Roles("tenant_manager")
  createAcao(
    @CurrentUser() user: RequestUser,
    @Param("cursoId", ParseUUIDPipe) cursoId: string,
    @Body() dto: CreateFormacaoAcaoDto,
  ) {
    return this.formacoes.createAcao(user, cursoId, dto);
  }

  @Get(":cursoId/acoes/:acaoId")
  @Roles("tenant_manager", "formador")
  getAcao(
    @CurrentUser() user: RequestUser,
    @Param("cursoId", ParseUUIDPipe) cursoId: string,
    @Param("acaoId", ParseUUIDPipe) acaoId: string,
  ) {
    return this.formacoes.getAcao(user, cursoId, acaoId);
  }

  @Patch(":cursoId/acoes/:acaoId")
  @Roles("tenant_manager")
  updateAcao(
    @CurrentUser() user: RequestUser,
    @Param("cursoId", ParseUUIDPipe) cursoId: string,
    @Param("acaoId", ParseUUIDPipe) acaoId: string,
    @Body() dto: UpdateFormacaoAcaoDto,
  ) {
    return this.formacoes.updateAcao(user, cursoId, acaoId, dto);
  }
}
