import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards, BadRequestException } from "@nestjs/common";
import type { TenantIntegracao } from "@nexiforma/database";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { RequestUser } from "../auth/types/access-token-payload";
import { IntegracoesService } from "./integracoes.service";
import { TeamsTranscriptService } from "./teams-transcript.service";
import { UpsertIntegracaoDto } from "./dto/integracoes.dto";
import { requireTenantId } from "../common/tenant-scope";

@Controller("integracoes")
@UseGuards(JwtAuthGuard, RolesGuard)
export class IntegracoesController {
  constructor(
    private readonly integracoes: IntegracoesService,
    private readonly teamsTranscript: TeamsTranscriptService,
  ) {}

  /** Estado Teams/Zoom do tenant - qualquer utilizador autenticado (sem segredos). */
  @Get("disponibilidade")
  disponibilidade(@CurrentUser() user: RequestUser) {
    return this.integracoes.disponibilidade(user);
  }

  @Get()
  @Roles("tenant_manager", "coordenador_pedagogico")
  list(@CurrentUser() user: RequestUser) {
    return this.integracoes.list(user);
  }

  @Post()
  @Roles("tenant_manager", "coordenador_pedagogico")
  upsert(@CurrentUser() user: RequestUser, @Body() dto: UpsertIntegracaoDto): Promise<TenantIntegracao> {
    return this.integracoes.upsert(user, dto);
  }

  @Post("sessoes/:sessaoId/reuniao")
  @Roles("tenant_manager", "coordenador_pedagogico", "formador")
  criarReuniao(
    @CurrentUser() user: RequestUser,
    @Param("sessaoId", ParseUUIDPipe) sessaoId: string,
    @Query("provider") provider: "ZOOM" | "TEAMS",
  ) {
    if (provider !== "ZOOM" && provider !== "TEAMS") {
      provider = "TEAMS";
    }
    return this.integracoes.criarReuniao(user, sessaoId, provider);
  }

  @Post("sessoes/:sessaoId/teams/transcricao")
  @Roles("tenant_manager", "coordenador_pedagogico", "formador")
  async importarTranscricaoSessao(
    @CurrentUser() user: RequestUser,
    @Param("sessaoId", ParseUUIDPipe) sessaoId: string,
  ) {
    const tenantId = requireTenantId(user);
    const result = await this.teamsTranscript.importarSessao(sessaoId, tenantId);
    return {
      estado: result.estado,
      teamsTranscricao: result.teamsTranscricao ?? null,
      mensagem: result.mensagem,
    };
  }

  @Get("oauth/status")
  @Roles("tenant_manager", "coordenador_pedagogico", "comercial")
  oauthStatus(@CurrentUser() user: RequestUser) {
    return this.integracoes.oauthStatus(user);
  }

  @Post("oauth/activar")
  @Roles("tenant_manager", "coordenador_pedagogico")
  activarOAuthReal(
    @CurrentUser() user: RequestUser,
    @Query("provider") provider?: "ZOOM" | "TEAMS" | "ALL",
  ) {
    const p = provider === "ZOOM" || provider === "TEAMS" ? provider : "ALL";
    return this.integracoes.activarOAuthReal(user, p);
  }

  @Post("testar")
  @Roles("tenant_manager", "coordenador_pedagogico")
  testarConexao(
    @CurrentUser() user: RequestUser,
    @Query("provider") provider: "ZOOM" | "TEAMS",
  ) {
    if (provider !== "ZOOM" && provider !== "TEAMS") {
      throw new BadRequestException("provider deve ser ZOOM ou TEAMS.");
    }
    return this.integracoes.testarConexao(user, provider);
  }

  @Get("moodle/sync")
  @Roles("tenant_manager", "coordenador_pedagogico")
  moodleSync(@CurrentUser() user: RequestUser, @Query("cursoId") cursoId?: string) {
    return this.integracoes.moodleSync(user, cursoId);
  }
}
