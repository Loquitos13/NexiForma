import { Body, Controller, Get, Post, Query, UseGuards, ParseUUIDPipe } from "@nestjs/common";
import type { Turma } from "@nexiforma/database";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { RequestUser } from "../auth/types/access-token-payload";
import { TurmasService } from "./turmas.service";
import { CreateTurmaDto } from "./dto/create-turma.dto";

@Controller("turmas")
@UseGuards(JwtAuthGuard, RolesGuard)
export class TurmasController {
  constructor(private readonly turmas: TurmasService) {}

  /** Filtro opcional por acção (`?acaoFormacaoId=uuid`). */
  @Get()
  @Roles("tenant_manager", "formador")
  list(
    @CurrentUser() user: RequestUser,
    @Query("acaoFormacaoId", new ParseUUIDPipe({ optional: true }))
    acaoFormacaoId?: string,
  ) {
    return this.turmas.list(user, acaoFormacaoId);
  }

  @Post()
  @Roles("tenant_manager")
  create(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateTurmaDto,
  ): Promise<Turma> {
    return this.turmas.create(user, dto);
  }
}
