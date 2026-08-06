import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  Post,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { RequestUser } from "../auth/types/access-token-payload";
import { AvaliacoesService } from "./avaliacoes.service";

@Controller("avaliacoes")
@UseGuards(JwtAuthGuard, RolesGuard)
export class AvaliacoesController {
  constructor(private readonly avaliacoes: AvaliacoesService) {}

  @Get("matricula/:matriculaId")
  @Roles("tenant_manager", "coordenador_pedagogico", "formador", "formando")
  list(@CurrentUser() user: RequestUser, @Param("matriculaId", ParseUUIDPipe) matriculaId: string) {
    return this.avaliacoes.list(user, matriculaId);
  }

  @Post("matricula/:matriculaId")
  @Roles("tenant_manager", "coordenador_pedagogico", "formador")
  create(
    @CurrentUser() user: RequestUser,
    @Param("matriculaId", ParseUUIDPipe) matriculaId: string,
    @Body() body: { tipo?: string; nota?: number; observacoes?: string },
  ) {
    return this.avaliacoes.create(user, matriculaId, body);
  }

  @Get("acao/:acaoId/pauta")
  @Roles("tenant_manager", "coordenador_pedagogico", "formador")
  getPauta(
    @CurrentUser() user: RequestUser,
    @Param("acaoId", ParseUUIDPipe) acaoId: string,
  ) {
    return this.avaliacoes.getPautaAcao(user, acaoId);
  }

  @Put("matricula/:matriculaId/pauta/:moduloUnidadeId")
  @Roles("tenant_manager", "coordenador_pedagogico", "formador")
  upsertPauta(
    @CurrentUser() user: RequestUser,
    @Param("matriculaId", ParseUUIDPipe) matriculaId: string,
    @Param("moduloUnidadeId", ParseUUIDPipe) moduloUnidadeId: string,
    @Body() body: { nota?: number | null },
  ) {
    const nota =
      body.nota === undefined || body.nota === null || Number.isNaN(Number(body.nota))
        ? null
        : Number(body.nota);
    return this.avaliacoes.upsertNotaPauta(user, matriculaId, moduloUnidadeId, nota);
  }
}
