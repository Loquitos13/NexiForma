// @ts-nocheck – modulo em desenvolvimento
import {
  Controller,
  Get,
  Post,
  Put,
  UseGuards,
  Req,
  Body,
  Param,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import type { Request } from "express";
import { SettingsService } from "./settings.service";

@Controller("settings")
export class SettingsController {
  constructor(private settingsService: SettingsService) {}

  @Get("tema")
  @UseGuards(JwtAuthGuard)
  async obterTemaUtilizador(@Req() req: any) {
    const userId = req.user?.sub;
    return this.settingsService.obterTemaUtilizador(userId);
  }

  @Put("tema")
  @UseGuards(JwtAuthGuard)
  async atualizarTemaUtilizador(
    @Req() req: any,
    @Body()
    settings: {
      primaryColor?: string;
      backgroundColor?: string;
      theme?: "light" | "dark" | "auto";
      fontSize?: "small" | "medium" | "large";
      language?: "pt" | "en";
    },
  ) {
    const userId = req.user?.sub;
    return this.settingsService.atualizarTemaUtilizador(userId, settings);
  }

  @Get("paleta")
  @UseGuards(JwtAuthGuard)
  async obterPaletaCores(@Req() req: any) {
    const userId = req.user?.sub;
    const tenantId = req.headers["x-tenant-id"] as string;
    return this.settingsService.obterPaletaCores(tenantId, userId);
  }

  @Get("css")
  @UseGuards(JwtAuthGuard)
  async exportarCssPersonalizado(@Req() req: any) {
    const userId = req.user?.sub;
    const tenantId = req.headers["x-tenant-id"] as string;
    const css = await this.settingsService.exportarCssPersonalizado(tenantId, userId);
    return { css };
  }

  @Get("tenant/branding")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("tenant_manager")
  async obterBrandingTenant(@Req() req: any) {
    const tenantId = req.headers["x-tenant-id"] as string;
    return this.settingsService.obterBrandingTenant(tenantId);
  }

  @Put("tenant/branding")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("tenant_manager")
  async atualizarBrandingTenant(
    @Req() req: any,
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
    const userId = req.user?.sub;
    const tenantId = req.headers["x-tenant-id"] as string;
    return this.settingsService.atualizarBrandingTenant(tenantId, userId, branding);
  }

  @Get("tenant/plano")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("tenant_manager")
  async obterPlanoTenant(@Req() req: any) {
    const tenantId = req.headers["x-tenant-id"] as string;
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
