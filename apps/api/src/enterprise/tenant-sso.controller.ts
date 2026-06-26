import { Body, Controller, Get, Patch, Query, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { SkipThrottle } from "@nestjs/throttler";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { RequestUser } from "../auth/types/access-token-payload";
import { TenantSsoService } from "./tenant-sso.service";

@Controller()
export class TenantSsoController {
  constructor(private readonly sso: TenantSsoService) {}

  @SkipThrottle()
  @Get("auth/sso/config")
  publicConfig(@Query("slug") slug: string) {
    return this.sso.getPublicConfig(slug?.trim() ?? "");
  }

  @SkipThrottle()
  @Get("auth/sso/start")
  start(@Query("slug") slug: string, @Res() res: Response) {
    return this.sso.startLogin(slug?.trim() ?? "", res);
  }

  @SkipThrottle()
  @Get("auth/sso/callback")
  callback(
    @Query("code") code: string,
    @Query("state") state: string,
    @Res() res: Response,
  ) {
    return this.sso.handleCallback(code, state, res);
  }

  @Get("enterprise/sso")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("tenant_manager")
  managerConfig(@CurrentUser() user: RequestUser) {
    return this.sso.getConfigForManager(user);
  }

  @Patch("enterprise/sso")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("tenant_manager")
  updateConfig(
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      enabled: boolean;
      providerLabel?: string;
      issuer?: string;
      clientId?: string;
      clientSecret?: string;
      scopes?: string[];
    },
  ) {
    return this.sso.updateConfig(user, body);
  }
}
