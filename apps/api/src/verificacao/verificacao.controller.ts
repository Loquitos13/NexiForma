import { Controller, Get, Param } from "@nestjs/common";
import { Public } from "../auth/decorators/public.decorator";
import { CertificadoVerificacaoService } from "../certificados/certificado-verificacao.service";

/** Endpoints públicos – validação de certificados via QR/código. */
@Public()
@Controller("verificacao")
export class VerificacaoController {
  constructor(private readonly verificacao: CertificadoVerificacaoService) {}

  @Get("certificados/:token")
  verificarCertificado(@Param("token") token: string) {
    return this.verificacao.verificarPublico(token);
  }
}
