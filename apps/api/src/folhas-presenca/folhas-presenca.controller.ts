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
} from "@nestjs/common";
import type { Response } from "express";
import type { FolhaPresenca, Presenca } from "@nexiforma/database";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { RequestUser } from "../auth/types/access-token-payload";
import { AprovarFolhaDto } from "./dto/aprovar-folha.dto";
import { ValidarFolhaDto } from "./dto/validar-folha.dto";
import { CreateFolhaPresencaDto } from "./dto/create-folha-presenca.dto";
import { UpdatePresencaDto } from "./dto/update-presenca.dto";
import { FolhasPresencaService } from "./folhas-presenca.service";
import { FolhaPresencaHtmlExportService } from "./folha-presenca-html-export.service";

@Controller("folhas-presenca")
@UseGuards(JwtAuthGuard, RolesGuard)
export class FolhasPresencaController {
  constructor(
    private readonly folhas: FolhasPresencaService,
    private readonly htmlExport: FolhaPresencaHtmlExportService,
  ) {}

  @Get()
  @Roles("tenant_manager", "coordenador_pedagogico", "formador")
  list(
    @CurrentUser() user: RequestUser,
    @Query("sessaoId", ParseUUIDPipe) sessaoId: string,
    @Query("turmaId", new ParseUUIDPipe({ optional: true })) turmaId?: string,
  ) {
    return this.folhas.listBySessao(user, sessaoId, turmaId);
  }

  @Get(":id/presencas.html")
  @Roles("tenant_manager", "coordenador_pedagogico", "formador")
  async presencasHtml(
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

  @Patch(":id/validar")
  @Roles("tenant_manager", "coordenador_pedagogico", "formador")
  validar(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ValidarFolhaDto,
  ): Promise<FolhaPresenca> {
    return this.folhas.validarFormador(user, id, dto.nomeAssinatura);
  }

  @Patch(":id/aprovar")
  @Roles("tenant_manager", "coordenador_pedagogico")
  aprovar(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: AprovarFolhaDto,
  ): Promise<FolhaPresenca> {
    return this.folhas.aprovarGestor(user, id, dto.nomeAssinatura);
  }

  @Get(":id")
  @Roles("tenant_manager", "coordenador_pedagogico", "formador")
  detail(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.folhas.getDetail(user, id);
  }

  @Post()
  @Roles("tenant_manager", "coordenador_pedagogico", "formador")
  create(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateFolhaPresencaDto,
  ): Promise<FolhaPresenca> {
    return this.folhas.create(user, dto);
  }

  @Patch(":id/fechar")
  @Roles("tenant_manager", "coordenador_pedagogico")
  fechar(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: AprovarFolhaDto,
  ): Promise<FolhaPresenca> {
    return this.folhas.fechar(user, id, dto.nomeAssinatura);
  }
}

@Controller("presencas")
@UseGuards(JwtAuthGuard, RolesGuard)
export class PresencasController {
  constructor(private readonly folhas: FolhasPresencaService) {}

  @Patch(":id")
  @Roles("tenant_manager", "coordenador_pedagogico", "formador")
  update(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdatePresencaDto,
  ): Promise<Presenca> {
    return this.folhas.updatePresenca(user, id, dto);
  }
}

@Controller("presenca-checkin")
@UseGuards(JwtAuthGuard, RolesGuard)
export class PresencaCheckinController {
  constructor(private readonly folhas: FolhasPresencaService) {}

  /** Rotas estáticas antes de :token para não capturar "sessao" como token. */
  @Get("sessao/:sessaoId")
  @Roles("formando")
  statusSessao(
    @CurrentUser() user: RequestUser,
    @Param("sessaoId", ParseUUIDPipe) sessaoId: string,
  ) {
    return this.folhas.getCheckinStatusBySessao(user, sessaoId);
  }

  @Post("sessao/:sessaoId")
  @Roles("formando")
  checkinSessao(
    @CurrentUser() user: RequestUser,
    @Param("sessaoId", ParseUUIDPipe) sessaoId: string,
  ) {
    return this.folhas.checkinBySessao(user, sessaoId);
  }

  @Get(":token")
  @Roles("formando")
  info(@CurrentUser() user: RequestUser, @Param("token") token: string) {
    return this.folhas.getCheckinInfo(user, token);
  }

  @Post(":token")
  @Roles("formando")
  checkin(@CurrentUser() user: RequestUser, @Param("token") token: string) {
    return this.folhas.checkinByQrToken(user, token);
  }
}
