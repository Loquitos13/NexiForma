import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";
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
  @Roles("tenant_manager", "formador", "formando")
  list(@CurrentUser() user: RequestUser, @Param("matriculaId", ParseUUIDPipe) matriculaId: string) {
    return this.avaliacoes.list(user, matriculaId);
  }

  @Post("matricula/:matriculaId")
  @Roles("tenant_manager", "formador")
  create(
    @CurrentUser() user: RequestUser,
    @Param("matriculaId", ParseUUIDPipe) matriculaId: string,
    @Body() body: { tipo?: string; nota?: number; observacoes?: string },
  ) {
    return this.avaliacoes.create(user, matriculaId, body);
  }
}
