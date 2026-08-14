import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { RequestUser } from "../auth/types/access-token-payload";
import { DDOS_WINDOW_MS } from "../common/ddos-throttle.config";
import { ValidarNifDto } from "./dto/validar-nif.dto";
import { ViesService, type ValidarNifUiResposta } from "./vies.service";

/**
 * Endpoint mínimo para feedback de UI.
 * A API key NIF.PT fica só no servidor.
 */
@Controller("nif")
@UseGuards(JwtAuthGuard, RolesGuard)
export class ViesController {
  constructor(private readonly vies: ViesService) {}

  @Post("validar")
  @Roles("tenant_manager", "comercial", "formador", "coordenador_pedagogico")
  @Throttle({ default: { limit: 40, ttl: DDOS_WINDOW_MS } })
  validar(
    @CurrentUser() user: RequestUser,
    @Body() dto: ValidarNifDto,
  ): Promise<ValidarNifUiResposta> {
    return this.vies.validarParaUi(user, dto.nif.trim(), dto.tipo);
  }
}
