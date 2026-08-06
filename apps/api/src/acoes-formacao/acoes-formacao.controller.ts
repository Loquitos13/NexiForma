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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { IsOptional, IsString, MinLength } from "class-validator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { RequestUser } from "../auth/types/access-token-payload";
import { CreateAcaoFormacaoDto } from "./dto/create-acao-formacao.dto";
import { UpdateAcaoFormacaoDto } from "./dto/update-acao-formacao.dto";
import { AcoesFormacaoService } from "./acoes-formacao.service";

class GerarTemplateDto {
  @IsString()
  @MinLength(2)
  categoria!: string;

  @IsOptional()
  @IsString()
  html?: string;
}

@Controller("acoes-formacao")
@UseGuards(JwtAuthGuard, RolesGuard)
export class AcoesFormacaoController {
  constructor(private readonly acoesFormacao: AcoesFormacaoService) {}

  @Get()
  @Roles("tenant_manager", "coordenador_pedagogico", "formador")
  list(@CurrentUser() user: RequestUser) {
    return this.acoesFormacao.list(user);
  }

  @Get(":id/templates")
  @Roles("tenant_manager", "coordenador_pedagogico")
  listTemplates(@CurrentUser() user: RequestUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.acoesFormacao.listTemplates(user, id);
  }

  @Get(":id/documentos-resumo")
  @Roles("tenant_manager", "coordenador_pedagogico")
  documentosResumo(@CurrentUser() user: RequestUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.acoesFormacao.documentosResumo(user, id);
  }

  @Get(":id/conclusao-prontidao")
  @Roles("tenant_manager", "coordenador_pedagogico")
  conclusaoProntidao(@CurrentUser() user: RequestUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.acoesFormacao.getConclusaoProntidao(user, id);
  }

  @Post(":id/templates/upload")
  @Roles("tenant_manager", "coordenador_pedagogico")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 20 * 1024 * 1024 } }))
  uploadTemplate(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Query("categoria") categoria: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.acoesFormacao.uploadTemplate(user, id, categoria, file);
  }

  @Post(":id/templates/gerar")
  @Roles("tenant_manager", "coordenador_pedagogico")
  gerarTemplate(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: GerarTemplateDto,
  ) {
    return this.acoesFormacao.gerarTemplatePdf(user, id, body);
  }

  @Get(":id/templates/:categoria/download")
  @Roles("tenant_manager", "coordenador_pedagogico", "formador")
  async downloadTemplate(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("categoria") categoria: string,
    @Res() res: Response,
  ) {
    const file = await this.acoesFormacao.streamTemplate(user, id, categoria);
    res.setHeader("Content-Type", file.contentType);
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(file.nome)}"`);
    res.setHeader("Cache-Control", "private, no-store");
    res.send(file.body);
  }

  @Get(":id")
  @Roles("tenant_manager", "coordenador_pedagogico", "formador")
  detail(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.acoesFormacao.getOne(user, id);
  }

  @Post()
  @Roles("tenant_manager", "coordenador_pedagogico")
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateAcaoFormacaoDto) {
    return this.acoesFormacao.create(user, dto);
  }

  @Patch(":id")
  @Roles("tenant_manager", "coordenador_pedagogico")
  update(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateAcaoFormacaoDto,
  ) {
    return this.acoesFormacao.update(user, id, dto);
  }

  @Post(":id/concluir")
  @Roles("tenant_manager", "coordenador_pedagogico")
  concluir(@CurrentUser() user: RequestUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.acoesFormacao.concluir(user, id);
  }
}
