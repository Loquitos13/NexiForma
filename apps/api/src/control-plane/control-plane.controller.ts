import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
  BadRequestException,
} from "@nestjs/common";
import type { Request, Response } from "express";
import type { TenantIntegracao } from "@nexiforma/database";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { RequestUser } from "../auth/types/access-token-payload";
import { ControlPlaneService } from "./control-plane.service";
import { ImpersonationService } from "./impersonation.service";
import { IntegracoesService } from "../integracoes/integracoes.service";
import { UpsertIntegracaoDto } from "../integracoes/dto/integracoes.dto";
import {
  CreateSubscriptionKeyDto,
  ImpersonateDto,
  UpdateTenantStatusDto,
} from "./dto/control-plane.dto";

@Controller("control-plane")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("super_admin")
export class ControlPlaneController {
  constructor(
    private readonly cp: ControlPlaneService,
    private readonly impersonation: ImpersonationService,
    private readonly integracoes: IntegracoesService,
  ) {}

  @Get("metrics")
  metrics() {
    return this.cp.platformMetrics();
  }

  @Get("tenants")
  listTenants() {
    return this.cp.listTenants();
  }

  @Get("tenants/:id")
  getTenant(@Param("id") id: string): Promise<Record<string, unknown>> {
    return this.cp.getTenant(id);
  }

  @Get("tenants/:id/users")
  listTenantUsers(@Param("id") id: string) {
    return this.cp.listTenantUsers(id);
  }

  @Patch("tenants/:id/status")
  updateStatus(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body() dto: UpdateTenantStatusDto,
    @Req() req: Request,
  ): Promise<Record<string, unknown>> {
    const ip = typeof req.ip === "string" ? req.ip : undefined;
    return this.cp.updateTenantStatus(user, id, dto.status, ip);
  }

  @Post("tenants/:id/impersonate")
  impersonate(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body() dto: ImpersonateDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ip = typeof req.ip === "string" ? req.ip : undefined;
    return this.impersonation.startImpersonation(user, id, dto, res, ip);
  }

  @Get("audit-logs")
  auditLogs(
    @Query("tenantId") tenantId?: string,
    @Query("limit") limit?: string,
  ): Promise<Record<string, unknown>[]> {
    return this.cp.listAuditLogs(tenantId, limit ? Number(limit) : undefined);
  }

  @Post("tenants/:id/subscription-keys")
  createKey(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body() dto: CreateSubscriptionKeyDto,
    @Req() req: Request,
  ) {
    const ip = typeof req.ip === "string" ? req.ip : undefined;
    return this.cp.createSubscriptionKey(user, id, dto, ip);
  }

  @Post("tenants/:tenantId/subscription-keys/:keyId/revoke")
  revokeKey(
    @CurrentUser() user: RequestUser,
    @Param("tenantId") tenantId: string,
    @Param("keyId") keyId: string,
    @Req() req: Request,
  ) {
    const ip = typeof req.ip === "string" ? req.ip : undefined;
    return this.cp.revokeSubscriptionKey(user, tenantId, keyId, ip);
  }

  @Get("tenants/:id/integracoes")
  listIntegracoes(@Param("id") id: string) {
    return this.integracoes.listForTenant(id);
  }

  @Get("tenants/:id/integracoes/oauth/status")
  integracoesOAuthStatus(@Param("id") id: string) {
    return this.integracoes.oauthStatusForTenant(id);
  }

  @Post("tenants/:id/integracoes")
  upsertIntegracao(@Param("id") id: string, @Body() dto: UpsertIntegracaoDto): Promise<TenantIntegracao> {
    return this.integracoes.upsertForTenant(id, dto, { provisionedByPlatform: true });
  }

  @Post("tenants/:id/integracoes/oauth/activar")
  activarIntegracaoOAuth(
    @Param("id") id: string,
    @Query("provider") provider?: "ZOOM" | "TEAMS" | "ALL",
  ) {
    const p = provider === "ZOOM" || provider === "TEAMS" ? provider : "ALL";
    return this.integracoes.activarOAuthRealForTenant(id, p);
  }

  @Post("tenants/:id/integracoes/testar")
  testarIntegracao(
    @Param("id") id: string,
    @Query("provider") provider: "ZOOM" | "TEAMS",
  ) {
    return this.integracoes.testarConexaoForTenant(id, provider);
  }

  @Get("tenants/:id/integracoes/microsoft/admin-consent-url")
  microsoftAdminConsent(@Param("id") id: string, @Query("m365TenantId") m365TenantId?: string) {
    const tid = m365TenantId?.trim();
    if (!tid) {
      throw new BadRequestException("Query m365TenantId é obrigatório.");
    }
    return this.integracoes.getMicrosoftAdminConsentUrl(tid);
  }
}
