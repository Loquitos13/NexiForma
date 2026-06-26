import { Controller, Get, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { RequestUser } from "../auth/types/access-token-payload";
import { RelatoriosService } from "./relatorios.service";

@Controller("relatorios")
@UseGuards(JwtAuthGuard, RolesGuard)
export class RelatoriosController {
  constructor(private readonly relatorios: RelatoriosService) {}

  @Get("executivo")
  @Roles("tenant_manager")
  executivo(@CurrentUser() user: RequestUser) {
    return this.relatorios.executivo(user);
  }

  @Get("inspecao")
  @Roles("tenant_manager")
  inspecao(@CurrentUser() user: RequestUser) {
    return this.relatorios.inspecao(user);
  }
}
