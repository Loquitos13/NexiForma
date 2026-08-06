import { BadRequestException, Body, Controller, Get, Patch, Post, Query, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { SkipThrottle } from "@nestjs/throttler";
import { Public } from "./decorators/public.decorator";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { RolesGuard } from "./guards/roles.guard";
import { Roles } from "./decorators/roles.decorator";
import { CurrentUser } from "./decorators/current-user.decorator";
import type { RequestUser } from "./types/access-token-payload";
import { SocialAuthService } from "./social-auth.service";
import { normalizeQueryParam } from "./tenant-auth-resolve.util";

@Controller()
export class SocialAuthController {
  constructor(private readonly social: SocialAuthService) {}

  @SkipThrottle()
  @Public()
  @Get("auth/oauth/providers")
  providers(@Query("slug") slug: unknown) {
    return this.social.getPublicProviders(normalizeQueryParam(slug));
  }

  @SkipThrottle()
  @Public()
  @Get("auth/oauth/google/start")
  startGoogle(
    @Query("slug") slug: unknown,
    @Query("return_to") returnTo: unknown,
    @Res() res: Response,
  ) {
    return this.social.startLogin(
      "google",
      normalizeQueryParam(slug),
      res,
      normalizeQueryParam(returnTo) || undefined,
    );
  }

  @SkipThrottle()
  @Public()
  @Get("auth/oauth/microsoft/start")
  startMicrosoft(
    @Query("slug") slug: unknown,
    @Query("return_to") returnTo: unknown,
    @Res() res: Response,
  ) {
    return this.social.startLogin(
      "microsoft",
      normalizeQueryParam(slug),
      res,
      normalizeQueryParam(returnTo) || undefined,
    );
  }

  @SkipThrottle()
  @Public()
  @Get("auth/oauth/callback")
  callback(
    @Query("code") code: unknown,
    @Query("state") state: unknown,
    @Query("error") error: unknown,
    @Res() res: Response,
  ) {
    return this.social.handleCallback(
      normalizeQueryParam(code) || undefined,
      normalizeQueryParam(state) || undefined,
      res,
      normalizeQueryParam(error) || undefined,
    );
  }

  @SkipThrottle()
  @Public()
  @Get("auth/public/tenant-logo")
  tenantLogo(@Query("slug") slug: unknown, @Res() res: Response) {
    return this.social.streamPublicTenantLogo(normalizeQueryParam(slug), res);
  }

  @SkipThrottle()
  @Public()
  @Get("auth/oauth/pick-options")
  pickOptions(@Query("pick") pick: unknown) {
    const token = normalizeQueryParam(pick);
    if (!token) {
      throw new BadRequestException("Token de selecção OAuth em falta.");
    }
    return this.social.getOAuthPickOptions(token);
  }

  @SkipThrottle()
  @Public()
  @Post("auth/oauth/pick-tenant")
  pickTenant(
    @Body() body: { pick?: string; tenantSlug?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const pick = body.pick?.trim();
    const tenantSlug = body.tenantSlug?.trim();
    if (!pick || !tenantSlug) {
      throw new BadRequestException("Seleção de entidade incompleta.");
    }
    return this.social.completeOAuthPick(pick, tenantSlug, res);
  }

  @SkipThrottle()
  @Public()
  @Post("auth/oauth/exchange")
  exchange(@Body() body: { exchange?: string }, @Res({ passthrough: true }) res: Response) {
    const token = body.exchange?.trim();
    if (!token) {
      throw new BadRequestException("Exchange OAuth em falta.");
    }
    return this.social.exchangeSession(token, res);
  }

  @Get("enterprise/social-login")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("tenant_manager")
  managerConfig(@CurrentUser() user: RequestUser) {
    return this.social.getManagerConfig(user);
  }

  @Patch("enterprise/social-login")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("tenant_manager")
  updateConfig(
    @CurrentUser() user: RequestUser,
    @Body() body: { google?: boolean; microsoft?: boolean },
  ) {
    return this.social.updateManagerConfig(user, body);
  }
}
