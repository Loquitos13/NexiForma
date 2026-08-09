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
import type { Sumario } from "@nexiforma/database";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { RequestUser } from "../auth/types/access-token-payload";
import { AssinarSumarioDto } from "./dto/assinar-sumario.dto";
import { CreateSumarioDto } from "./dto/create-sumario.dto";
import { UpdateSumarioDto } from "./dto/update-sumario.dto";
import { SumariosService } from "./sumarios.service";

@Controller("sumarios")
@UseGuards(JwtAuthGuard, RolesGuard)
export class SumariosController {
  constructor(private readonly sumarios: SumariosService) {}

  @Get()
  @Roles("tenant_manager", "coordenador_pedagogico", "formador")
  list(
    @CurrentUser() user: RequestUser,
    @Query("sessaoId", ParseUUIDPipe) sessaoId: string,
  ) {
    return this.sumarios.listBySessao(user, sessaoId);
  }

  @Post("sessao/:sessaoId")
  @Roles("tenant_manager", "coordenador_pedagogico", "formador")
  create(
    @CurrentUser() user: RequestUser,
    @Param("sessaoId", ParseUUIDPipe) sessaoId: string,
    @Body() dto: CreateSumarioDto,
  ): Promise<Sumario> {
    return this.sumarios.create(user, sessaoId, dto);
  }

  @Patch(":id")
  @Roles("tenant_manager", "coordenador_pedagogico", "formador")
  update(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateSumarioDto,
  ): Promise<Sumario> {
    return this.sumarios.update(user, id, dto);
  }

  @Post(":id/assinar")
  @Roles("tenant_manager", "coordenador_pedagogico", "formador")
  assinar(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: AssinarSumarioDto,
  ): Promise<Sumario> {
    return this.sumarios.assinar(user, id, dto);
  }

  @Post(":id/upload-pdf-assinado")
  @Roles("tenant_manager", "coordenador_pedagogico", "formador")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 20 * 1024 * 1024 } }))
  uploadPdfAssinado(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<Sumario> {
    return this.sumarios.uploadPdfAssinado(user, id, file);
  }

  @Get(":id/pdf")
  @Roles("tenant_manager", "coordenador_pedagogico", "formador")
  async downloadPdf(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const file = await this.sumarios.streamPdf(user, id);
    res.setHeader("Content-Type", file.contentType);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${encodeURIComponent(file.nome)}"`,
    );
    res.setHeader("Cache-Control", "private, no-store");
    res.send(file.body);
  }

  @Get(":id/export.html")
  @Roles("tenant_manager", "coordenador_pedagogico", "formador")
  async exportHtml(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const pkg = await this.sumarios.buildPrintableHtml(user, id);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${encodeURIComponent(pkg.filename)}"`,
    );
    res.setHeader("Cache-Control", "private, no-store");
    res.send(pkg.html);
  }
}
