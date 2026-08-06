import {
  Controller,
  Get,
  Put,
  UseGuards,
  Req,
  Body,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { SettingsService } from "./settings.service";
import { requireTenantId } from "../common/tenant-scope";
import type { RequestUser } from "../auth/types/access-token-payload";

@Controller("settings")
export class SettingsController {
  constructor(private settingsService: SettingsService) {}

  @Get("tema")
  @UseGuards(JwtAuthGuard)
  async obterTemaUtilizador(@Req() req: { user: RequestUser }) {
    return this.settingsService.obterTemaUtilizador(req.user.sub);
  }

  @Put("tema")
  @UseGuards(JwtAuthGuard)
  async atualizarTemaUtilizador(
    @Req() req: { user: RequestUser },
    @Body()
    settings: {
      primaryColor?: string;
      backgroundColor?: string;
      theme?: "light" | "dark" | "auto";
      fontSize?: "small" | "medium" | "large";
      language?: "pt" | "en";
    },
  ) {
    return this.settingsService.atualizarTemaUtilizador(req.user.sub, settings);
  }

  @Get("paleta")
  @UseGuards(JwtAuthGuard)
  async obterPaletaCores(@Req() req: { user: RequestUser }) {
    const tenantId = requireTenantId(req.user);
    return this.settingsService.obterPaletaCores(tenantId, req.user.sub);
  }

  @Get("css")
  @UseGuards(JwtAuthGuard)
  async exportarCssPersonalizado(@Req() req: { user: RequestUser }) {
    const tenantId = requireTenantId(req.user);
    const css = await this.settingsService.exportarCssPersonalizado(tenantId, req.user.sub);
    return { css };
  }

  @Get("tenant/branding")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("tenant_manager")
  async obterBrandingTenant(@Req() req: { user: RequestUser }) {
    const tenantId = requireTenantId(req.user);
    return this.settingsService.obterBrandingTenant(tenantId);
  }

  @Put("tenant/branding")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("tenant_manager")
  async atualizarBrandingTenant(
    @Req() req: { user: RequestUser },
    @Body()
    branding: {
      logoUrl?: string;
      primaryColor: string;
      secondaryColor: string;
      companyName: string;
      supportEmail: string;
      supportPhone?: string;
      footerText?: string;
    },
  ) {
    const tenantId = requireTenantId(req.user);
    return this.settingsService.atualizarBrandingTenant(tenantId, req.user.sub, branding);
  }

  @Get("tenant/plano")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("tenant_manager")
  async obterPlanoTenant(@Req() req: { user: RequestUser }) {
    const tenantId = requireTenantId(req.user);
    return this.settingsService.obterPlanoTenant(tenantId);
  }

  @Get("planos")
  async listarPlanos() {
    return this.settingsService.listarPlanosDisponibles();
  }

  @Get("health")
  async health() {
    return {
      status: "ok",
      timestamp: new Date(),
      endpoints: {
        usuario: "/settings/tema, /settings/css",
        tenant: "/settings/tenant/branding, /settings/tenant/plano",
        publico: "/settings/planos",
      },
    };
  }
}
