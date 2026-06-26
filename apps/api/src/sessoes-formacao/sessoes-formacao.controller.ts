import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import type { SessaoFormacao } from "@nexiforma/database";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { RequestUser } from "../auth/types/access-token-payload";
import { CreateSessaoFormacaoDto } from "./dto/create-sessao-formacao.dto";
import { UpdateSessaoFormacaoDto } from "./dto/update-sessao-formacao.dto";
import { SessoesFormacaoService } from "./sessoes-formacao.service";

@Controller("sessoes-formacao")
@UseGuards(JwtAuthGuard, RolesGuard)
export class SessoesFormacaoController {
  constructor(private readonly sessoes: SessoesFormacaoService) {}

  @Get()
  @Roles("tenant_manager", "formador")
  list(
    @CurrentUser() user: RequestUser,
    @Query("cronogramaId", new ParseUUIDPipe({ optional: true }))
    cronogramaId?: string,
  ) {
    return this.sessoes.list(user, cronogramaId);
  }

  @Post()
  @Roles("tenant_manager", "formador")
  create(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateSessaoFormacaoDto,
  ): Promise<SessaoFormacao> {
    return this.sessoes.create(user, dto);
  }

  @Patch(":id")
  @Roles("tenant_manager", "formador")
  update(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateSessaoFormacaoDto,
  ) {
    return this.sessoes.update(user, id, dto);
  }

  @Post(":id/iniciar")
  @Roles("formador")
  iniciar(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.sessoes.iniciar(user, id);
  }

  @Post(":id/terminar")
  @Roles("formador")
  terminar(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.sessoes.terminar(user, id);
  }
}
