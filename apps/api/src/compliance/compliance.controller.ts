import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { RequestUser } from "../auth/types/access-token-payload";
import { ComplianceService } from "./compliance.service";
import { ComplianceAlertasService } from "./compliance-alertas.service";

@Controller("compliance")
@UseGuards(JwtAuthGuard, RolesGuard)
export class ComplianceController {
  constructor(
    private readonly compliance: ComplianceService,
    private readonly alertasService: ComplianceAlertasService,
  ) {}

  @Get("alertas")
  @Roles("tenant_manager")
  listAlertas(@CurrentUser() user: RequestUser) {
    return this.alertasService.listAlertas(user);
  }

  @Get("resumo")
  @Roles("tenant_manager")
  resumo(@CurrentUser() user: RequestUser) {
    return this.compliance.resumo(user);
  }

  @Get("acoes-formacao/:acaoId")
  @Roles("tenant_manager")
  byAcao(
    @CurrentUser() user: RequestUser,
    @Param("acaoId", ParseUUIDPipe) acaoId: string,
  ) {
    return this.compliance.getByAcao(user, acaoId);
  }
}
