import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { DDOS_WINDOW_MS } from "../common/ddos-throttle.config";
import { ValidarNifDto } from "./dto/validar-nif.dto";
import { ViesService } from "./vies.service";

/**
 * Endpoint mínimo para feedback de UI.
 * A API key NIF.PT fica só no servidor - a resposta é apenas { valido }.
 */
@Controller("nif")
@UseGuards(JwtAuthGuard, RolesGuard)
export class ViesController {
  constructor(private readonly vies: ViesService) {}

  @Post("validar")
  @Roles("tenant_manager", "comercial", "formador")
  @Throttle({ default: { limit: 40, ttl: DDOS_WINDOW_MS } })
  async validar(@Body() dto: ValidarNifDto): Promise<{ valido: boolean }> {
    try {
      await this.vies.assertConfirmado(dto.nif.trim(), dto.tipo, "PT");
      return { valido: true };
    } catch {
      return { valido: false };
    }
  }
}
