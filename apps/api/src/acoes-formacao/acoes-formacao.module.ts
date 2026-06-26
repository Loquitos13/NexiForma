import { Module } from "@nestjs/common";
import { AcoesFormacaoController } from "./acoes-formacao.controller";
import { AcoesFormacaoService } from "./acoes-formacao.service";

@Module({
  controllers: [AcoesFormacaoController],
  providers: [AcoesFormacaoService],
})
export class AcoesFormacaoModule {}
