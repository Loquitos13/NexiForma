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
import {
  AtribuirFormadorCronogramaDto,
  NotificarAtribuicaoFormadorDto,
} from "./dto/atribuir-formador.dto";
import { TerminarSessaoDto } from "./dto/terminar-sessao.dto";
import { SessoesFormacaoService } from "./sessoes-formacao.service";

@Controller("sessoes-formacao")
@UseGuards(JwtAuthGuard, RolesGuard)
export class SessoesFormacaoController {
  constructor(private readonly sessoes: SessoesFormacaoService) {}

  @Get()
  @Roles("tenant_manager", "coordenador_pedagogico", "formador")
  list(
    @CurrentUser() user: RequestUser,
    @Query("cronogramaId", new ParseUUIDPipe({ optional: true }))
    cronogramaId?: string,
    @Query("turmaId", new ParseUUIDPipe({ optional: true }))
    turmaId?: string,
  ) {
    return this.sessoes.list(user, cronogramaId, turmaId);
  }

  /** Pendências de folha/sumário do formador autenticado (lembrete no logout). */
  @Get("pendencias-documentacao")
  @Roles("formador")
  pendenciasDocumentacao(@CurrentUser() user: RequestUser) {
    return this.sessoes.listPendenciasDocumentacaoFormador(user);
  }

  /** Após confirmar «Sair na mesma» com pendências → email ao dep. pedagógico. */
  @Post("pendencias-documentacao/avisar-pedagogico")
  @Roles("formador")
  avisarPedagogicoPendenciasLogout(@CurrentUser() user: RequestUser) {
    return this.sessoes.avisarPedagogicoPendenciasLogout(user);
  }

  @Post("atribuir-formador")
  @Roles("tenant_manager", "coordenador_pedagogico")
  atribuirFormador(
    @CurrentUser() user: RequestUser,
    @Body() dto: AtribuirFormadorCronogramaDto,
  ) {
    return this.sessoes.atribuirFormadorCronograma(user, dto);
  }

  @Post("notificar-atribuicao")
  @Roles("tenant_manager", "coordenador_pedagogico")
  notificarAtribuicao(
    @CurrentUser() user: RequestUser,
    @Body() dto: NotificarAtribuicaoFormadorDto,
  ) {
    return this.sessoes.notificarAtribuicaoFormadores(user, dto);
  }

  @Post()
  @Roles("tenant_manager", "coordenador_pedagogico", "formador")
  create(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateSessaoFormacaoDto,
  ): Promise<SessaoFormacao> {
    return this.sessoes.create(user, dto);
  }

  @Patch(":id")
  @Roles("tenant_manager", "coordenador_pedagogico", "formador")
  update(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateSessaoFormacaoDto,
  ) {
    return this.sessoes.update(user, id, dto);
  }

  @Post(":id/iniciar")
  @Roles("formador", "tenant_manager")
  iniciar(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.sessoes.iniciar(user, id);
  }

  /** Token/URL do QR de presença (único por sessão; exige sessão iniciada). */
  @Get(":id/presenca-qr")
  @Roles("formador", "tenant_manager")
  presencaQr(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Query("force") force?: string,
  ) {
    const forceRenew = force === "1" || force === "true";
    return this.sessoes.getPresencaQr(user, id, { force: forceRenew });
  }

  /** Abre a sessão para o formador e inicia o contador de presença. */
  @Post(":id/entrar-formador")
  @Roles("formador", "tenant_manager")
  entrarFormador(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.sessoes.entrarFormador(user, id);
  }

  @Post(":id/terminar")
  @Roles("formador", "tenant_manager")
  terminar(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: TerminarSessaoDto,
  ) {
    return this.sessoes.terminar(user, id, dto ?? {});
  }
}
