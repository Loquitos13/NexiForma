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
import { Public } from "./decorators/public.decorator";
import { CurrentUser } from "./decorators/current-user.decorator";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import type { RequestUser } from "./types/access-token-payload";
import { AuthService } from "./auth.service";
import { PlatformLoginDto } from "./dto/platform-login.dto";
import { TenantLoginDto } from "./dto/tenant-login.dto";
import {
  PlatformForgotPasswordDto,
  PlatformResetPasswordDto,
  PreviewPasswordResetDto,
  TenantForgotPasswordDto,
  TenantResetPasswordDto,
} from "./dto/forgot-password.dto";
import { SetupMfaConfirmDto, EnrollMfaConfirmDto, EnrollMfaSetupDto, VerifyMfaDto } from "./dto/mfa.dto";
import { CognitoAuthService } from "./cognito-auth.service";
import { MfaService } from "./mfa.service";
import { ChangeRequiredPasswordDto } from "./dto/change-required-password.dto";
import { SkipMustChangePassword } from "./decorators/skip-must-change-password.decorator";

@UseGuards(ThrottlerGuard)
@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly mfa: MfaService,
    private readonly cognito: CognitoAuthService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("tenant/login")
  @HttpCode(200)
  tenantLogin(@Body() dto: TenantLoginDto, @Res({ passthrough: true }) res: Response) {
    return this.auth.loginTenant(dto, res);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("platform/login")
  @HttpCode(200)
  platformLogin(@Body() dto: PlatformLoginDto, @Res({ passthrough: true }) res: Response) {
    return this.auth.loginPlatform(dto, res);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("tenant/forgot-password")
  @HttpCode(200)
  tenantForgotPassword(@Body() dto: TenantForgotPasswordDto, @Req() req: Request) {
    return this.auth.requestTenantPasswordReset(dto, req);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("platform/forgot-password")
  @HttpCode(200)
  platformForgotPassword(@Body() dto: PlatformForgotPasswordDto, @Req() req: Request) {
    return this.auth.requestPlatformPasswordReset(dto, req);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("tenant/reset-password/preview")
  @HttpCode(200)
  previewTenantReset(@Body() dto: PreviewPasswordResetDto) {
    return this.auth.previewTenantPasswordReset(dto);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("platform/reset-password/preview")
  @HttpCode(200)
  previewPlatformReset(@Body() dto: PreviewPasswordResetDto) {
    return this.auth.previewPlatformPasswordReset(dto);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("tenant/reset-password")
  @HttpCode(200)
  tenantResetPassword(@Body() dto: TenantResetPasswordDto) {
    return this.auth.confirmTenantPasswordReset(dto);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("platform/reset-password")
  @HttpCode(200)
  platformResetPassword(@Body() dto: PlatformResetPasswordDto) {
    return this.auth.confirmPlatformPasswordReset(dto);
  }

  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Post("refresh")
  @HttpCode(200)
  refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.auth.refreshFromCookie(req, res);
  }

  @Public()
  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  @Post("logout")
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.auth.logoutFromCookie(req, res);
  }

  @SkipThrottle()
  @Get("me")
  @UseGuards(JwtAuthGuard)
  @SkipMustChangePassword()
  me(@CurrentUser() user: RequestUser) {
    return this.auth.meProfile(user);
  }

  @Post("tenant/change-required-password")
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  @SkipMustChangePassword()
  changeRequiredPassword(
    @CurrentUser() user: RequestUser,
    @Body() dto: ChangeRequiredPasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.auth.changeRequiredPassword(user, dto, res);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("mfa/verify")
  @HttpCode(200)
  verifyMfa(
    @Body() dto: VerifyMfaDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.auth.verifyMfaLogin(dto.mfaToken, dto.code, res, dto.rememberMe);
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
    return this.mfa.confirmSetup(user, dto.code, dto.mfaApp);
  }

  @Public()
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  @Post("mfa/enroll/setup")
  @HttpCode(200)
  enrollMfaSetup(@Body() dto: EnrollMfaSetupDto) {
    return this.auth.mfaEnrollSetup(dto.mfaToken);
  }

  @Public()
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  @Post("mfa/enroll/confirm")
  @HttpCode(200)
  enrollMfaConfirm(
    @Body() dto: EnrollMfaConfirmDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.auth.mfaEnrollConfirm(dto.mfaToken, dto.code, dto.mfaApp, res, dto.rememberMe);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
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
