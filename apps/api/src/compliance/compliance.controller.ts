import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { RequestUser } from "../auth/types/access-token-payload";
import { requireTenantId } from "../common/tenant-scope";
import { AuditService } from "../audit/audit.service";
import { resolveTenantAuditPrefixes } from "../audit/tenant-audit-scopes.util";
import { ComplianceService } from "./compliance.service";
import { ComplianceAlertasService } from "./compliance-alertas.service";

@Controller("compliance")
@UseGuards(JwtAuthGuard, RolesGuard)
export class ComplianceController {
  constructor(
    private readonly compliance: ComplianceService,
    private readonly alertasService: ComplianceAlertasService,
    private readonly audit: AuditService,
  ) {}

  @Get("alertas")
  @Roles("tenant_manager", "coordenador_pedagogico")
  listAlertas(@CurrentUser() user: RequestUser) {
    return this.alertasService.listAlertas(user);
  }

  @Get("resumo")
  @Roles("tenant_manager", "coordenador_pedagogico")
  resumo(@CurrentUser() user: RequestUser) {
    return this.compliance.resumo(user);
  }

  @Get("acoes-formacao/:acaoId")
  @Roles("tenant_manager", "coordenador_pedagogico")
  byAcao(
    @CurrentUser() user: RequestUser,
    @Param("acaoId", ParseUUIDPipe) acaoId: string,
  ) {
    return this.compliance.getByAcao(user, acaoId);
  }

  @Get("audit-trail")
  @Roles("tenant_manager", "coordenador_pedagogico")
  auditTrail(
    @CurrentUser() user: RequestUser,
    @Query("limit") limit?: string,
    @Query("cursor") cursor?: string,
    @Query("action") action?: string,
    @Query("sinceDays") sinceDays?: string,
    @Query("q") q?: string,
  ) {
    const tenantId = requireTenantId(user);
    const days = sinceDays ? parseInt(sinceDays, 10) : 90;
    const since =
      Number.isFinite(days) && days > 0
        ? new Date(Date.now() - days * 24 * 60 * 60 * 1000)
        : undefined;
    return this.audit.list({
      tenantId,
      limit: limit ? parseInt(limit, 10) : 100,
      cursor: cursor ? BigInt(cursor) : undefined,
      action: action?.trim() || undefined,
      actionPrefixes: action?.trim()
        ? undefined
        : resolveTenantAuditPrefixes("dgert"),
      since,
      q: q?.trim() || undefined,
    });
  }
}
