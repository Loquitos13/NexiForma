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
import type { Cronograma } from "@nexiforma/database";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { RequestUser } from "../auth/types/access-token-payload";
import { CronogramasService } from "./cronogramas.service";
import { CronogramaHtmlExportService } from "./cronograma-html-export.service";
import { CronogramaArquivoService } from "./cronograma-arquivo.service";
import { CreateCronogramaDto } from "./dto/create-cronograma.dto";

@Controller("cronogramas")
@UseGuards(JwtAuthGuard, RolesGuard)
export class CronogramasController {
  constructor(
    private readonly cronogramas: CronogramasService,
    private readonly htmlExport: CronogramaHtmlExportService,
    private readonly arquivo: CronogramaArquivoService,
  ) {}

  @Get()
  @Roles("tenant_manager", "formador")
  list(
    @CurrentUser() user: RequestUser,
    @Query("acaoFormacaoId", new ParseUUIDPipe({ optional: true }))
    acaoFormacaoId?: string,
  ) {
    return this.cronogramas.list(user, acaoFormacaoId);
  }

  @Get("acoes-formacao/:acaoId/arquivos")
  @Roles("tenant_manager", "formador")
  listArquivos(
    @CurrentUser() user: RequestUser,
    @Param("acaoId", ParseUUIDPipe) acaoId: string,
  ) {
    return this.arquivo.listByAcao(user, acaoId);
  }

  @Get("arquivos/:arquivoId/download")
  @Roles("tenant_manager", "formador")
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
  @Roles("tenant_manager")
  create(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateCronogramaDto,
  ): Promise<Cronograma> {
    return this.cronogramas.create(user, dto);
  }

  @Get(":id/cronograma.html")
  @Roles("tenant_manager", "formador")
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
  @Roles("tenant_manager", "formador")
  arquivarTransferivel(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.arquivo.storeTransferivel(user, id);
  }

  @Patch(":id/aprovar")
  @Roles("tenant_manager")
  async aprovar(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    const cronograma = await this.cronogramas.aprovar(user, id);
    const arquivo = await this.arquivo.storeTransferivel(user, id);
    return { cronograma, arquivo };
  }
}
