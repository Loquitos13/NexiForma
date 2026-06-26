import { Body, Controller, Get, Patch, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { RequestUser } from "../auth/types/access-token-payload";
import { ConsentService } from "./consent.service";
import { UpdateConsentDto } from "./consent.dto";

@Controller("consent")
@UseGuards(JwtAuthGuard, RolesGuard)
export class ConsentController {
  constructor(private readonly consent: ConsentService) {}

  @Get("me")
  me(@CurrentUser() user: RequestUser) {
    return this.consent.getMe(user);
  }

  @Patch("me")
  updateMe(@CurrentUser() user: RequestUser, @Body() dto: UpdateConsentDto) {
    return this.consent.updateMe(user, dto);
  }

  @Get("tenant")
  @Roles("tenant_manager")
  listTenant(@CurrentUser() user: RequestUser) {
    return this.consent.listForTenant(user);
  }

  @Get("platform")
  @Roles("super_admin")
  listPlatform(@CurrentUser() user: RequestUser, @Query("tenantId") tenantId?: string) {
    return this.consent.listPlatform(user, tenantId);
  }
}
