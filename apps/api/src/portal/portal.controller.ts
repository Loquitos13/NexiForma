import {
  Body,
  Controller,
  Get,
  Put,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import type { RequestUser } from "../auth/types/access-token-payload";
import { PortalService } from "./portal.service";
import { TenantSettingsService } from "./tenant-settings.service";

/**
 * Recursos só para utilizadores do tenant (gestão/formador).
 */
@Controller("portal")
export class PortalController {
  constructor(
    private readonly portal: PortalService,
    private readonly tenantSettings: TenantSettingsService,
  ) {}

  @Get("dashboard")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("tenant_manager", "formador")
  dashboard(@CurrentUser() user: RequestUser) {
    return this.portal.dashboard(user);
  }

  @Get("tenant-info")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("tenant_manager", "formador", "comercial")
  tenantInfo(@CurrentUser() user: RequestUser) {
    return this.tenantSettings.getTenantInfo(user);
  }

  @Get("tenant/branding")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("tenant_manager")
  branding(@CurrentUser() user: RequestUser) {
    return this.tenantSettings.getBranding(user);
  }

  @Put("tenant/branding")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("tenant_manager")
  updateBranding(
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      logoUrl?: string;
      primaryColor?: string;
      secondaryColor?: string;
      companyName?: string;
      supportEmail?: string;
      supportPhone?: string;
      footerText?: string;
      cronograma?: {
        local?: string;
        horarioInicio?: string;
        horarioFim?: string;
        horarioSabadoInicio?: string;
        horarioSabadoFim?: string;
        funcionamento?: "laboral" | "pos_laboral" | "misto";
        metodologias?: string[];
      };
    },
  ) {
    return this.tenantSettings.updateBranding(user, body);
  }

  @Post("tenant/logo")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("tenant_manager")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 2 * 1024 * 1024 } }))
  uploadLogo(@CurrentUser() user: RequestUser, @UploadedFile() file: Express.Multer.File) {
    return this.tenantSettings.uploadLogo(user, file);
  }

  @Get("tenant/logo")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("tenant_manager", "formador", "comercial")
  async streamLogo(@CurrentUser() user: RequestUser, @Res() res: Response) {
    const obj = await this.tenantSettings.streamLogo(user);
    if (!obj) {
      res.status(404).send("Logo não configurado.");
      return;
    }
    res.setHeader("Content-Type", obj.contentType);
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.send(obj.body);
  }
}
