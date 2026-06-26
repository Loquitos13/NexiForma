import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { RequestUser } from "../auth/types/access-token-payload";
import { SigoIntegrationService } from "./sigo-integration.service";

@Controller("sigo")
@UseGuards(JwtAuthGuard, RolesGuard)
export class SigoController {
  constructor(private readonly sigo: SigoIntegrationService) {}

  @Get("config")
  @Roles("tenant_manager")
  config() {
    return this.sigo.getConfig();
  }

  @Get("submissoes")
  @Roles("tenant_manager")
  submissoes(@CurrentUser() user: RequestUser, @Query("acaoId") acaoId?: string): Promise<unknown> {
    return this.sigo.listSubmissoes(user, acaoId);
  }

  @Get("acoes-formacao/:acaoId/submissoes")
  @Roles("tenant_manager")
  submissoesAcao(@CurrentUser() user: RequestUser, @Param("acaoId", ParseUUIDPipe) acaoId: string): Promise<unknown> {
    return this.sigo.listSubmissoesAcao(user, acaoId);
  }

  @Post("submissoes/:id/reconciliar")
  @Roles("tenant_manager")
  reconcile(@CurrentUser() user: RequestUser, @Param("id", ParseUUIDPipe) id: string): Promise<unknown> {
    return this.sigo.reconcile(user, id);
  }

  @Post("submissoes/:id/reenviar")
  @Roles("tenant_manager")
  resubmit(@CurrentUser() user: RequestUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.sigo.resubmit(user, id);
  }

  @Post("acoes-formacao/:acaoId/submit")
  @Roles("tenant_manager")
  submit(@CurrentUser() user: RequestUser, @Param("acaoId") acaoId: string) {
    return this.sigo.submitAcao(user, acaoId);
  }
}
