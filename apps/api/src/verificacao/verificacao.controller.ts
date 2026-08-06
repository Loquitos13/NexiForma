import { Controller, Get, Param } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Public } from "../auth/decorators/public.decorator";
import { CertificadoVerificacaoService } from "../certificados/certificado-verificacao.service";
import { DDOS_WINDOW_MS } from "../common/ddos-throttle.config";

/** Endpoints públicos – validação de certificados via QR/código. */
@Public()
@Controller("verificacao")
export class VerificacaoController {
  constructor(private readonly verificacao: CertificadoVerificacaoService) {}

  @Get("certificados/:token")
  @Throttle({ default: { limit: 20, ttl: DDOS_WINDOW_MS } })
  verificarCertificado(@Param("token") token: string) {
    return this.verificacao.verificarPublico(token);
  }
}
