import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards, BadRequestException } from "@nestjs/common";
import type { TenantIntegracao } from "@nexiforma/database";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { RequestUser } from "../auth/types/access-token-payload";
import { IntegracoesService } from "./integracoes.service";
import { UpsertIntegracaoDto } from "./dto/integracoes.dto";

@Controller("integracoes")
@UseGuards(JwtAuthGuard, RolesGuard)
export class IntegracoesController {
  constructor(private readonly integracoes: IntegracoesService) {}

  @Get("disponibilidade")
  @Roles("tenant_manager", "formador")
  disponibilidade(@CurrentUser() user: RequestUser) {
    return this.integracoes.disponibilidade(user);
  }

  @Get()
  @Roles("tenant_manager")
  list(@CurrentUser() user: RequestUser) {
    return this.integracoes.list(user);
  }

  @Post()
  @Roles("tenant_manager")
  upsert(@CurrentUser() user: RequestUser, @Body() dto: UpsertIntegracaoDto): Promise<TenantIntegracao> {
    return this.integracoes.upsert(user, dto);
  }

  @Post("sessoes/:sessaoId/reuniao")
  @Roles("tenant_manager", "formador")
  criarReuniao(
    @CurrentUser() user: RequestUser,
    @Param("sessaoId", ParseUUIDPipe) sessaoId: string,
    @Query("provider") provider: "ZOOM" | "TEAMS",
  ) {
    if (provider !== "ZOOM" && provider !== "TEAMS") {
      provider = "ZOOM";
    }
    return this.integracoes.criarReuniao(user, sessaoId, provider);
  }

  @Get("oauth/status")
  @Roles("tenant_manager")
  oauthStatus(@CurrentUser() user: RequestUser) {
    return this.integracoes.oauthStatus(user);
  }

  @Post("oauth/activar")
  @Roles("tenant_manager")
  activarOAuthReal(
    @CurrentUser() user: RequestUser,
    @Query("provider") provider?: "ZOOM" | "TEAMS" | "ALL",
  ) {
    const p = provider === "ZOOM" || provider === "TEAMS" ? provider : "ALL";
    return this.integracoes.activarOAuthReal(user, p);
  }

  @Post("testar")
  @Roles("tenant_manager")
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
  @Roles("tenant_manager")
  moodleSync(@CurrentUser() user: RequestUser, @Query("cursoId") cursoId?: string) {
    return this.integracoes.moodleSync(user, cursoId);
  }
}
