import { Module } from "@nestjs/common";
import { NotificacoesModule } from "../notificacoes/notificacoes.module";
import { AcoesFormacaoController } from "./acoes-formacao.controller";
import { AcoesFormacaoService } from "./acoes-formacao.service";

@Module({
  imports: [NotificacoesModule],
  controllers: [AcoesFormacaoController],
  providers: [AcoesFormacaoService],
})
export class AcoesFormacaoModule {}
