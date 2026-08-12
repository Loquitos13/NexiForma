import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
  ParseUUIDPipe,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Request, Response } from "express";
import type { TenantIntegracao } from "@nexiforma/database";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { RequestUser } from "../auth/types/access-token-payload";
import { ControlPlaneService } from "./control-plane.service";
import { ImpersonationService } from "./impersonation.service";
import { IntegracoesService } from "../integracoes/integracoes.service";
import { UpsertIntegracaoDto } from "../integracoes/dto/integracoes.dto";
import { FaturasService } from "../faturas/faturas.service";
import { UpdateConfigFaturacaoDto } from "../faturas/dto/fatura.dto";
import { SocialAuthService } from "../auth/social-auth.service";
import { extractClientIp } from "../common/client-ip.util";
import {
  CreateSubscriptionKeyDto,
  CreateTenantDto,
  ImpersonateDto,
  InviteManagerDto,
  SetTenantManagerDto,
  UpdateTenantDto,
  UpdateTenantStatusDto,
  UpdateTenantSubscriptionDto,
  UpdatePlatformMeDto,
  UpdateTenantLoginLockoutDto,
  ClearTenantLoginLockoutDto,
} from "./dto/control-plane.dto";

@Controller("control-plane")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("super_admin")
export class ControlPlaneController {
  constructor(
    private readonly cp: ControlPlaneService,
    private readonly impersonation: ImpersonationService,
    private readonly integracoes: IntegracoesService,
    private readonly faturas: FaturasService,
    private readonly socialAuth: SocialAuthService,
  ) {}

  @Get("metrics")
  metrics() {
    return this.cp.platformMetrics();
  }

  @Get("dashboard")
  dashboard() {
    return this.cp.platformDashboard();
  }

  @Get("crm/tenants")
  crmTenants() {
    return this.cp.listCrmTenants();
  }

  @Get("account")
  getAccount(@CurrentUser() user: RequestUser) {
    return this.cp.getPlatformAccount(user);
  }

  @Patch("account")
  updateAccount(
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdatePlatformMeDto,
    @Req() req: Request,
  ) {
    const ip = extractClientIp(req);
    return this.cp.updatePlatformAccount(user, dto, ip);
  }

  @Get("subscription-plans")
  listSubscriptionPlans(): Promise<Record<string, unknown>[]> {
    return this.cp.listSubscriptionPlans();
  }

  @Get("tenants")
  listTenants(): Promise<Record<string, unknown>[]> {
    return this.cp.listTenants();
  }

  @Post("tenants")
  createTenant(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateTenantDto,
    @Req() req: Request,
  ): Promise<Record<string, unknown>> {
    const ip = extractClientIp(req);
    return this.cp.createTenant(user, dto, ip, req);
  }

  @Get("tenants/:id")
  getTenant(@Param("id", ParseUUIDPipe) id: string): Promise<Record<string, unknown>> {
    return this.cp.getTenant(id);
  }

  @Post("tenants/:id/logo")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 2 * 1024 * 1024 } }))
  uploadTenantLogo(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
  ) {
    const ip = extractClientIp(req);
    return this.cp.uploadTenantLogo(user, id, file, ip);
  }

  @Get("tenants/:id/logo")
  async streamTenantLogo(
    @Param("id", ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const obj = await this.cp.streamTenantLogo(id);
    if (!obj) {
      res.status(404).send("Logo não configurado.");
      return;
    }
    res.setHeader("Content-Type", obj.contentType);
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.send(obj.body);
  }

  @Get("tenants/:id/faturacao")
  getTenantFaturacao(@Param("id", ParseUUIDPipe) id: string) {
    return this.faturas.getConfigForTenant(id);
  }

  @Patch("tenants/:id/faturacao")
  updateTenantFaturacao(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateConfigFaturacaoDto,
  ) {
    return this.faturas.updateConfigForTenantAsPlatform(user, id, dto);
  }

  @Post("tenants/:id/faturacao/testar-at")
  testarTenantLigacaoAt(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.faturas.testarLigacaoAtAsPlatform(user, id);
  }

  @Get("tenants/:id/social-login")
  getTenantSocialLogin(@Param("id", ParseUUIDPipe) id: string) {
    return this.socialAuth.getSocialLoginConfigForTenant(id);
  }

  @Patch("tenants/:id/social-login")
  updateTenantSocialLogin(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: { google?: boolean; microsoft?: boolean },
  ) {
    return this.socialAuth.updateSocialLoginConfigForTenant(id, body);
  }

  @Get("tenants/:id/login-lockout")
  getTenantLoginLockout(@Param("id", ParseUUIDPipe) id: string) {
    return this.cp.getTenantLoginLockout(id);
  }

  @Patch("tenants/:id/login-lockout")
  updateTenantLoginLockout(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateTenantLoginLockoutDto,
    @Req() req: Request,
  ) {
    const ip = extractClientIp(req);
    return this.cp.updateTenantLoginLockout(user, id, dto, ip);
  }

  @Post("tenants/:id/login-lockout/clear")
  clearTenantLoginLockout(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ClearTenantLoginLockoutDto,
    @Req() req: Request,
  ) {
    const ip = extractClientIp(req);
    return this.cp.clearTenantLoginLockout(user, id, dto.email, ip);
  }

  @Patch("tenants/:id")
  updateTenant(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateTenantDto,
    @Req() req: Request,
  ): Promise<Record<string, unknown>> {
    const ip = extractClientIp(req);
    return this.cp.updateTenant(user, id, dto, ip);
  }

  @Delete("tenants/:id")
  deleteTenant(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Query("permanent") permanent: string | undefined,
    @Req() req: Request,
  ) {
    const ip = extractClientIp(req);
    return this.cp.deleteTenant(user, id, { permanent: permanent === "true" }, ip);
  }

  @Get("tenants/:id/users")
  listTenantUsers(@Param("id", ParseUUIDPipe) id: string) {
    return this.cp.listTenantUsers(id);
  }

  @Patch("tenants/:id/status")
  updateStatus(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateTenantStatusDto,
    @Req() req: Request,
  ): Promise<Record<string, unknown>> {
    const ip = extractClientIp(req);
    return this.cp.updateTenantStatus(user, id, dto.status, ip);
  }

  @Patch("tenants/:id/subscription")
  updateSubscription(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateTenantSubscriptionDto,
    @Req() req: Request,
  ): Promise<Record<string, unknown>> {
    const ip = extractClientIp(req);
    return this.cp.updateTenantSubscription(user, id, dto, ip);
  }

  @Post("tenants/:id/manager")
  setManager(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: SetTenantManagerDto,
    @Req() req: Request,
  ): Promise<Record<string, unknown>> {
    const ip = extractClientIp(req);
    return this.cp.setTenantManager(user, id, dto, ip, req);
  }

  @Post("tenants/:id/manager-invite")
  inviteManager(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: InviteManagerDto,
    @Req() req: Request,
  ): Promise<Record<string, unknown>> {
    const ip = extractClientIp(req);
    return this.cp.inviteTenantManager(user, id, dto, ip, req);
  }

  @Post("tenants/:id/impersonate")
  impersonate(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body() dto: ImpersonateDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ip = extractClientIp(req);
    return this.impersonation.startImpersonation(user, id, dto, res, ip);
  }

  @Get("audit-logs")
  auditLogs(
    @Query("tenantId") tenantId?: string,
    @Query("limit") limit?: string,
    @Query("action") action?: string,
    @Query("actorType") actorType?: string,
    @Query("since") since?: string,
    @Query("q") q?: string,
    @Query("cursor") cursor?: string,
  ): Promise<Record<string, unknown>[]> {
    return this.cp.listAuditLogs({
      tenantId,
      limit: limit ? Number(limit) : undefined,
      action,
      actorType,
      since,
      q,
      cursor,
    });
  }

  @Post("tenants/:id/subscription-keys")
  createKey(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body() dto: CreateSubscriptionKeyDto,
    @Req() req: Request,
  ) {
    const ip = extractClientIp(req);
    return this.cp.createSubscriptionKey(user, id, dto, ip);
  }

  @Post("tenants/:tenantId/subscription-keys/:keyId/revoke")
  revokeKey(
    @CurrentUser() user: RequestUser,
    @Param("tenantId") tenantId: string,
    @Param("keyId") keyId: string,
    @Req() req: Request,
  ) {
    const ip = extractClientIp(req);
    return this.cp.revokeSubscriptionKey(user, tenantId, keyId, ip);
  }

  @Get("tenants/:id/integracoes")
  listIntegracoes(@Param("id") id: string) {
    return this.integracoes.listForTenant(id);
  }

  @Get("tenants/:id/integracoes/oauth/status")
  integracoesOAuthStatus(@Param("id") id: string) {
    return this.integracoes.oauthStatusForTenant(id);
  }

  @Post("tenants/:id/integracoes")
  upsertIntegracao(@Param("id") id: string, @Body() dto: UpsertIntegracaoDto): Promise<TenantIntegracao> {
    return this.integracoes.upsertForTenant(id, dto, { provisionedByPlatform: true });
  }

  @Post("tenants/:id/integracoes/oauth/activar")
  activarIntegracaoOAuth(
    @Param("id") id: string,
    @Query("provider") provider?: "ZOOM" | "TEAMS" | "ALL",
  ) {
    const p = provider === "ZOOM" || provider === "TEAMS" ? provider : "ALL";
    return this.integracoes.activarOAuthRealForTenant(id, p);
  }

  @Post("tenants/:id/integracoes/testar")
  testarIntegracao(
    @Param("id") id: string,
    @Query("provider") provider: "ZOOM" | "TEAMS",
  ) {
    return this.integracoes.testarConexaoForTenant(id, provider);
  }

  @Get("tenants/:id/integracoes/microsoft/admin-consent-url")
  microsoftAdminConsent(@Param("id") id: string, @Query("m365TenantId") m365TenantId?: string) {
    const tid = m365TenantId?.trim();
    if (!tid) {
      throw new BadRequestException("Query m365TenantId é obrigatório.");
    }
    return this.integracoes.getMicrosoftAdminConsentUrl(tid);
  }
}
