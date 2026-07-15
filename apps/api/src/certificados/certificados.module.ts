import { Module, forwardRef } from "@nestjs/common";
import { CertificadosController } from "./certificados.controller";
import { CertificadosService } from "./certificados.service";
import { CertificadoVerificacaoService } from "./certificado-verificacao.service";
import { VerificacaoCertificadoService } from "./verificacao.service";
import { VerificacaoPublicaController } from "./verificacao-cmd.controller";
import { NotificacoesModule } from "../notificacoes/notificacoes.module";
import { SigoModule } from "../sigo/sigo.module";

@Module({
  imports: [forwardRef(() => NotificacoesModule), forwardRef(() => SigoModule)],
  controllers: [
    CertificadosController,
    VerificacaoPublicaController,
  ],
  providers: [
    CertificadosService,
    CertificadoVerificacaoService,
    VerificacaoCertificadoService,
  ],
  exports: [
    CertificadosService,
    CertificadoVerificacaoService,
    VerificacaoCertificadoService,
  ],
})
export class CertificadosModule {}
