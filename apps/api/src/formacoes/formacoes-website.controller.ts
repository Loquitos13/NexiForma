import { Body, Controller, Get, Patch, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { RequestUser } from "../auth/types/access-token-payload";
import { requireTenantId } from "../common/tenant-scope";
import { FormacoesPublishService } from "./formacoes-publish.service";
import { UpdateWebsiteSyncDto } from "./dto/website-sync.dto";

@Controller("formacoes/website")
@UseGuards(JwtAuthGuard, RolesGuard)
export class FormacoesWebsiteController {
  constructor(private readonly publish: FormacoesPublishService) {}

  @Get("config")
  @Roles("tenant_manager")
  config(@CurrentUser() user: RequestUser) {
    return this.publish.getWebsiteConfig(requireTenantId(user));
  }

  @Patch("config")
  @Roles("tenant_manager")
  updateConfig(@CurrentUser() user: RequestUser, @Body() dto: UpdateWebsiteSyncDto) {
    return this.publish.updateWebsiteConfig(requireTenantId(user), dto);
  }

  @Post("sync")
  @Roles("tenant_manager")
  async syncNow(@CurrentUser() user: RequestUser) {
    const tenantId = requireTenantId(user);
    const result = await this.publish.pushFullCatalog(tenantId, "catalog.full_sync");
    const ok = "ok" in result ? result.ok : !("skipped" in result && result.skipped);
    return { ok, ...result };
  }
}
