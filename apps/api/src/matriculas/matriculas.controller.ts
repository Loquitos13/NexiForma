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
import type { Matricula } from "@nexiforma/database";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { RequestUser } from "../auth/types/access-token-payload";
import { MatriculasService } from "./matriculas.service";
import { CreateMatriculaDto } from "./dto/create-matricula.dto";
import { UpdateMatriculaDto } from "./dto/update-matricula.dto";

@Controller("matriculas")
@UseGuards(JwtAuthGuard, RolesGuard)
export class MatriculasController {
  constructor(private readonly matriculas: MatriculasService) {}

  @Get()
  @Roles("tenant_manager", "coordenador_pedagogico", "formador")
  list(
    @CurrentUser() user: RequestUser,
    @Query("turmaId", ParseUUIDPipe) turmaId: string,
  ) {
    return this.matriculas.listByTurma(user, turmaId);
  }

  @Post()
  @Roles("tenant_manager", "coordenador_pedagogico")
  create(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateMatriculaDto,
  ): Promise<Matricula> {
    return this.matriculas.create(user, dto);
  }

  @Get(":id/documentos/:templateId/pdf")
  @Roles("tenant_manager", "coordenador_pedagogico", "formador")
  async emitirDocumentoPdf(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("templateId") templateId: string,
    @Query("anexar") anexar: string | undefined,
    @Query("download") download: string | undefined,
    @Res() res: Response,
  ) {
    const pkg = await this.matriculas.emitirDocumentoPdf(user, id, templateId, {
      anexar: anexar === "1" || anexar === "true",
    });
    const asAttachment = download === "1" || download === "true";
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `${asAttachment ? "attachment" : "inline"}; filename="${encodeURIComponent(pkg.filename)}"`,
    );
    if (pkg.documentoId) {
      res.setHeader("X-Documento-Anexo-Id", pkg.documentoId);
    }
    res.setHeader("Cache-Control", "private, no-store");
    res.send(pkg.pdf);
  }

  @Patch(":id")
  @Roles("tenant_manager", "coordenador_pedagogico")
  updateEstado(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateMatriculaDto,
  ) {
    return this.matriculas.updateEstado(user, id, dto);
  }
}
