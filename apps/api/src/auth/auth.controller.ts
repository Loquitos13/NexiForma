import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { SkipThrottle, Throttle, ThrottlerGuard } from "@nestjs/throttler";
import { CurrentUser } from "./decorators/current-user.decorator";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import type { RequestUser } from "./types/access-token-payload";
import { AuthService } from "./auth.service";
import { PlatformLoginDto } from "./dto/platform-login.dto";
import { TenantLoginDto } from "./dto/tenant-login.dto";
import {
  PlatformForgotPasswordDto,
  TenantForgotPasswordDto,
} from "./dto/forgot-password.dto";
import { SetupMfaConfirmDto, VerifyMfaDto } from "./dto/mfa.dto";
import { CognitoAuthService } from "./cognito-auth.service";
import { MfaService } from "./mfa.service";

@UseGuards(ThrottlerGuard)
@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly mfa: MfaService,
    private readonly cognito: CognitoAuthService,
  ) {}

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("tenant/login")
  @HttpCode(200)
  tenantLogin(@Body() dto: TenantLoginDto, @Res({ passthrough: true }) res: Response) {
    return this.auth.loginTenant(dto, res);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("platform/login")
  @HttpCode(200)
  platformLogin(@Body() dto: PlatformLoginDto, @Res({ passthrough: true }) res: Response) {
    return this.auth.loginPlatform(dto, res);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("tenant/forgot-password")
  @HttpCode(200)
  tenantForgotPassword(@Body() dto: TenantForgotPasswordDto) {
    return this.auth.resetTenantPassword(dto);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("platform/forgot-password")
  @HttpCode(200)
  platformForgotPassword(@Body() dto: PlatformForgotPasswordDto) {
    return this.auth.resetPlatformPassword(dto);
  }

  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Post("refresh")
  @HttpCode(200)
  refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.auth.refreshFromCookie(req, res);
  }

  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  @Post("logout")
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.auth.logoutFromCookie(req, res);
  }

  @SkipThrottle()
  @Get("me")
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: RequestUser) {
    return user;
  }

  @Post("mfa/verify")
  @HttpCode(200)
  verifyMfa(
    @Body() dto: VerifyMfaDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.auth.verifyMfaLogin(dto.mfaToken, dto.code, res);
  }

  @Post("mfa/setup")
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  setupMfa(@CurrentUser() user: RequestUser) {
    return this.mfa.setup(user);
  }

  @Post("mfa/confirm")
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  confirmMfa(@CurrentUser() user: RequestUser, @Body() dto: SetupMfaConfirmDto) {
    return this.mfa.confirmSetup(user, dto.code);
  }

  @Post("cognito/exchange")
  @HttpCode(200)
  cognitoExchange(
    @Body() body: { idToken: string; tenantSlug: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.cognito.exchangeIdToken(body.idToken, body.tenantSlug, res);
  }

  @Post("impersonation/end")
  @UseGuards(JwtAuthGuard)
  @HttpCode(204)
  async endImpersonation(
    @CurrentUser() user: RequestUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.endImpersonation(user, req, res);
  }
}
