import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import type { RgpdPedido } from "@nexiforma/database";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { RequestUser } from "../auth/types/access-token-payload";
import { RgpdService } from "./rgpd.service";
import { CreateRgpdPedidoDto } from "./dto/rgpd.dto";

@Controller("rgpd")
@UseGuards(JwtAuthGuard, RolesGuard)
export class RgpdController {
  constructor(private readonly rgpd: RgpdService) {}

  @Get("pedidos")
  @Roles("tenant_manager")
  list(@CurrentUser() user: RequestUser): Promise<RgpdPedido[]> {
    return this.rgpd.list(user);
  }

  @Post("pedidos")
  @Roles("tenant_manager")
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateRgpdPedidoDto): Promise<RgpdPedido> {
    return this.rgpd.create(user, dto);
  }

  @Post("me/export")
  @Roles("formando")
  exportSelf(@CurrentUser() user: RequestUser) {
    return this.rgpd.exportSelf(user);
  }
}
