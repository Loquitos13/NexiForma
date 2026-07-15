import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Query, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { RequestUser } from "../auth/types/access-token-payload";
import { SigoIntegrationService } from "./sigo-integration.service";
import { SigoCertificatesService } from "./sigo-certificates.service";
import { SigoTenantConfigService } from "./sigo-tenant-config.service";
import { UpdateSigoTenantConfigDto } from "./dto/sigo-config.dto";

@Controller("sigo")
@UseGuards(JwtAuthGuard, RolesGuard)
export class SigoController {
  constructor(
    private readonly sigo: SigoIntegrationService,
    private readonly certificados: SigoCertificatesService,
    private readonly tenantConfig: SigoTenantConfigService,
  ) {}

  @Get("config")
  @Roles("tenant_manager")
  config(@CurrentUser() user: RequestUser) {
    return this.sigo.getConfig(user);
  }

  @Get("tenant-config")
  @Roles("tenant_manager")
  getTenantConfig(@CurrentUser() user: RequestUser) {
    return this.tenantConfig.getPublicConfig(user);
  }

  @Put("tenant-config")
  @Roles("tenant_manager")
  upsertTenantConfig(
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateSigoTenantConfigDto,
  ) {
    return this.tenantConfig.upsert(user, dto);
  }

  @Post("config/testar")
  @Roles("tenant_manager")
  testarConfig(@CurrentUser() user: RequestUser) {
    return this.sigo.testConnection(user);
  }

  @Get("submissoes")
  @Roles("tenant_manager")
  submissoes(@CurrentUser() user: RequestUser, @Query("acaoId") acaoId?: string): Promise<unknown> {
    return this.sigo.listSubmissoes(user, acaoId);
  }

  @Get("acoes-formacao/:acaoId/submissoes")
  @Roles("tenant_manager")
  submissoesAcao(@CurrentUser() user: RequestUser, @Param("acaoId", ParseUUIDPipe) acaoId: string): Promise<unknown> {
    return this.sigo.listSubmissoesAcao(user, acaoId);
  }

  @Get("acoes-formacao/:acaoId/certificados")
  @Roles("tenant_manager", "formador")
  certificadosAcao(
    @CurrentUser() user: RequestUser,
    @Param("acaoId", ParseUUIDPipe) acaoId: string,
  ): Promise<unknown> {
    return this.certificados.listByAcao(user, acaoId);
  }

  @Get("submissoes/:id/certificados")
  @Roles("tenant_manager")
  certificadosSubmissao(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<unknown> {
    return this.certificados.listBySubmissao(user, id);
  }

  @Post("submissoes/:id/certificados/sincronizar")
  @Roles("tenant_manager")
  sincronizarCertificados(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Query("force") force?: string,
  ) {
    return this.certificados.syncFromSubmissao(user, id, {
      forceDownload: force === "1" || force === "true",
    });
  }

  @Get("certificados/:id/download")
  @Roles("tenant_manager", "formador", "formando")
  async downloadCertificado(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const pkg = await this.certificados.downloadStored(user, id);
    res.setHeader("Content-Type", pkg.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${pkg.filename}"`);
    res.send(pkg.buffer);
  }

  @Post("submissoes/:id/reconciliar")
  @Roles("tenant_manager")
  reconcile(@CurrentUser() user: RequestUser, @Param("id", ParseUUIDPipe) id: string): Promise<unknown> {
    return this.sigo.reconcile(user, id);
  }

  @Post("submissoes/:id/reenviar")
  @Roles("tenant_manager")
  resubmit(@CurrentUser() user: RequestUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.sigo.resubmit(user, id);
  }

  @Post("acoes-formacao/:acaoId/submit")
  @Roles("tenant_manager")
  submit(@CurrentUser() user: RequestUser, @Param("acaoId") acaoId: string) {
    return this.sigo.submitAcao(user, acaoId);
  }

  @Post("acoes-formacao/:acaoId/certificar")
  @Roles("tenant_manager")
  certificar(@CurrentUser() user: RequestUser, @Param("acaoId", ParseUUIDPipe) acaoId: string) {
    return this.sigo.certificarAcao(user, acaoId);
  }
}
