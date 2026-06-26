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
  @Roles("tenant_manager", "formador")
  list(
    @CurrentUser() user: RequestUser,
    @Query("sessaoId", ParseUUIDPipe) sessaoId: string,
    @Query("turmaId", new ParseUUIDPipe({ optional: true })) turmaId?: string,
  ) {
    return this.folhas.listBySessao(user, sessaoId, turmaId);
  }

  @Get(":id/presencas.html")
  @Roles("tenant_manager", "formador")
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
  @Roles("tenant_manager", "formador")
  validar(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<FolhaPresenca> {
    return this.folhas.validarFormador(user, id);
  }

  @Patch(":id/aprovar")
  @Roles("tenant_manager")
  aprovar(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<FolhaPresenca> {
    return this.folhas.aprovarGestor(user, id);
  }

  @Get(":id")
  @Roles("tenant_manager", "formador")
  detail(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.folhas.getDetail(user, id);
  }

  @Post()
  @Roles("tenant_manager", "formador")
  create(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateFolhaPresencaDto,
  ): Promise<FolhaPresenca> {
    return this.folhas.create(user, dto);
  }

  @Patch(":id/fechar")
  @Roles("tenant_manager")
  fechar(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<FolhaPresenca> {
    return this.folhas.fechar(user, id);
  }
}

@Controller("presencas")
@UseGuards(JwtAuthGuard, RolesGuard)
export class PresencasController {
  constructor(private readonly folhas: FolhasPresencaService) {}

  @Patch(":id")
  @Roles("tenant_manager", "formador")
  update(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdatePresencaDto,
  ): Promise<Presenca> {
    return this.folhas.updatePresenca(user, id, dto);
  }
}
