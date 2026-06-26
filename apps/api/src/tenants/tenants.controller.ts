import { Controller, Get, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { TenantsService } from "./tenants.service";

/** Gestão multi-tenant (Control Plane) – apenas super-admin. */
@Controller("tenants")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("super_admin")
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  @Get()
  list() {
    return this.tenants.listSummary();
  }
}
