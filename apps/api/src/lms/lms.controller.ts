import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { RequestUser } from "../auth/types/access-token-payload";
import { LmsService } from "./lms.service";
import { CreateLmsEventoDto } from "./dto/create-lms-evento.dto";

@Controller("lms")
@UseGuards(JwtAuthGuard, RolesGuard)
export class LmsController {
  constructor(private readonly lms: LmsService) {}

  @Post("eventos")
  @Roles("tenant_manager", "formador", "formando")
  register(@CurrentUser() user: RequestUser, @Body() dto: CreateLmsEventoDto): Promise<Record<string, unknown>> {
    return this.lms.registerEvent(user, dto);
  }

  @Get("presenca-estado")
  @Roles("tenant_manager", "formador", "formando")
  presencaEstado(
    @CurrentUser() user: RequestUser,
    @Query("matriculaId") matriculaId: string,
    @Query("sessaoFormacaoId") sessaoFormacaoId: string,
  ) {
    return this.lms.presencaEstado(user, matriculaId, sessaoFormacaoId);
  }

  @Get("acessos")
  @Roles("tenant_manager", "formador")
  acessos(
    @CurrentUser() user: RequestUser,
    @Query("sessaoFormacaoId") sessaoFormacaoId?: string,
    @Query("matriculaId") matriculaId?: string,
    @Query("acaoFormacaoId") acaoFormacaoId?: string,
  ): Promise<Record<string, unknown>[]> {
    return this.lms.listAcessos(user, { sessaoFormacaoId, matriculaId, acaoFormacaoId });
  }

  @Get("minhas-sessoes")
  @Roles("formando")
  minhasSessoes(@CurrentUser() user: RequestUser) {
    return this.lms.minhasSessoes(user);
  }

  @Get("sessoes/:sessaoId/painel-presenca")
  @Roles("tenant_manager", "formador")
  painelPresenca(
    @CurrentUser() user: RequestUser,
    @Param("sessaoId") sessaoId: string,
    @Query("turmaId") turmaId: string,
  ) {
    return this.lms.painelPresencaTurma(user, sessaoId, turmaId);
  }
}
