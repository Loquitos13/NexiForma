import {
  Body,
  Controller,
  Get,
  Put,
  Post,
  Query,
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

  @Put("tenant/entidade")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("tenant_manager")
  updateEntidade(
    @CurrentUser() user: RequestUser,
    @Body() body: { legalName?: string; nif?: string },
  ): Promise<{
    slug: string;
    legalName: string;
    nif: string;
    status: string;
    metadata: unknown;
  }> {
    return this.tenantSettings.updateEntidade(user, body);
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

  @Get("tenant/documentos-politica")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("tenant_manager", "coordenador_pedagogico")
  documentosPolitica(@CurrentUser() user: RequestUser) {
    return this.tenantSettings.getDocumentosPolitica(user);
  }

  @Put("tenant/documentos-politica")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("tenant_manager", "coordenador_pedagogico")
  updateDocumentosPolitica(
    @CurrentUser() user: RequestUser,
    @Body() body: { universaisObrigatorios?: string[] },
  ) {
    return this.tenantSettings.updateDocumentosPolitica(user, body);
  }

  @Get("tenant/avaliacao-parametros")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("tenant_manager", "coordenador_pedagogico")
  avaliacaoParametros(@CurrentUser() user: RequestUser) {
    return this.tenantSettings.getAvaliacaoParametros(user);
  }

  @Put("tenant/avaliacao-parametros")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("tenant_manager", "coordenador_pedagogico")
  updateAvaliacaoParametros(
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      notaMinimaAprovacao?: number;
      escalaMaxima?: number;
      tiposPermitidos?: string[];
      exigirObservacoesAbaixoMinima?: boolean;
    },
  ) {
    return this.tenantSettings.updateAvaliacaoParametros(user, body);
  }

  @Get("tenant/document-templates")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("tenant_manager", "coordenador_pedagogico", "comercial", "coordenador_comercial")
  documentTemplates(@CurrentUser() user: RequestUser, @Query("modulo") modulo: string) {
    return this.tenantSettings.getDocumentTemplates(user, modulo || "formacao");
  }

  @Put("tenant/document-templates")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("tenant_manager", "coordenador_pedagogico", "comercial", "coordenador_comercial")
  updateDocumentTemplates(
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      modulo: string;
      templates: Record<string, { conteudo: string; nome?: string; updatedAt?: string }>;
    },
  ) {
    return this.tenantSettings.updateDocumentTemplates(user, body);
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
