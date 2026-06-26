import { Module } from "@nestjs/common";
import { CertificadosModule } from "../certificados/certificados.module";
import { VerificacaoController } from "./verificacao.controller";

@Module({
  imports: [CertificadosModule],
  controllers: [VerificacaoController],
})
export class VerificacaoModule {}
