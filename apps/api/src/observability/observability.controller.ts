import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { ObservabilityService } from "./observability.service";

@Controller("control-plane/observability")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("super_admin")
export class ObservabilityController {
  constructor(private readonly obs: ObservabilityService) {}

  @Get("status")
  status() {
    return this.obs.platformStatus();
  }

  @Get("audit-export")
  auditExport(
    @Query("tenantId") tenantId?: string,
    @Query("limit") limit?: string,
    @Query("since") since?: string,
  ) {
    return this.obs.exportAuditForCloudWatch({
      tenantId,
      limit: limit ? Number(limit) : undefined,
      since,
    });
  }
}
