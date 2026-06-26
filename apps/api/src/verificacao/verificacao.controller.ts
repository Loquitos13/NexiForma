import { Controller, Get, Param } from "@nestjs/common";
import { CertificadoVerificacaoService } from "../certificados/certificado-verificacao.service";

/** Endpoints públicos – validação de certificados via QR/código. */
@Controller("verificacao")
export class VerificacaoController {
  constructor(private readonly verificacao: CertificadoVerificacaoService) {}

  @Get("certificados/:token")
  verificarCertificado(@Param("token") token: string) {
    return this.verificacao.verificarPublico(token);
  }
}
