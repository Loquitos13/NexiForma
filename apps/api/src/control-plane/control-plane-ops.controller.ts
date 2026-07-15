import { Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from "@nestjs/common";
import type { PlatformAlertStatus } from "@nexiforma/database";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { RequestUser } from "../auth/types/access-token-payload";
import { ControlPlaneOpsService } from "./control-plane-ops.service";

@Controller("control-plane/ops")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("super_admin")
export class ControlPlaneOpsController {
  constructor(private readonly ops: ControlPlaneOpsService) {}

  @Get("dashboard")
  dashboard(): Promise<unknown> {
    return this.ops.getDashboard();
  }

  @Get("alerts")
  listAlerts(
    @Query("status") status?: PlatformAlertStatus,
    @Query("tenantId") tenantId?: string,
    @Query("limit") limit?: string,
  ) {
    return this.ops.listAlerts({
      status,
      tenantId,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get("alerts/:id")
  getAlert(@Param("id", ParseUUIDPipe) id: string) {
    return this.ops.getAlert(id);
  }

  @Patch("alerts/:id/resolve")
  resolveAlert(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.ops.updateAlertStatus(id, "RESOLVED", user);
  }

  @Patch("alerts/:id/acknowledge")
  acknowledgeAlert(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.ops.updateAlertStatus(id, "ACKNOWLEDGED", user);
  }

  @Get("tenants/:id")
  tenantOps(@Param("id", ParseUUIDPipe) id: string): Promise<unknown> {
    return this.ops.getTenantOps(id);
  }

  @Post("health/run")
  runHealthChecks(@Query("tenantId") tenantId?: string): Promise<unknown> {
    return this.ops.runHealthChecks(tenantId);
  }
}
