import { Body, Controller, Get, Post, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import type { RgpdPedido } from "@nexiforma/database";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { RequestUser } from "../auth/types/access-token-payload";
import { RgpdService } from "./rgpd.service";
import { ExportSelfDto } from "./dto/export-self.dto";

@Controller("rgpd")
@UseGuards(JwtAuthGuard, RolesGuard)
export class RgpdController {
  constructor(private readonly rgpd: RgpdService) {}

  @Get("pedidos")
  @Roles("tenant_manager")
  list(@CurrentUser() user: RequestUser): Promise<RgpdPedido[]> {
    return this.rgpd.list(user);
  }

  /** Gera e devolve os dados do próprio utilizador (json | csv | txt). */
  @Post("me/export")
  @Roles("tenant_manager", "comercial", "formador", "formando")
  async exportSelf(
    @CurrentUser() user: RequestUser,
    @Body() dto: ExportSelfDto,
    @Res({ passthrough: false }) res: Response,
  ) {
    const file = await this.rgpd.exportSelfFile(user, dto?.format);
    res.setHeader("Content-Type", file.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${file.filename}"`);
    res.setHeader("Cache-Control", "no-store");
    res.send(file.body);
  }
}
