import { Module, forwardRef } from "@nestjs/common";
import { AssiduidadeModule } from "../assiduidade/assiduidade.module";
import { LmsModule } from "../lms/lms.module";
import { NotificacoesModule } from "../notificacoes/notificacoes.module";
import { IntegracoesModule } from "../integracoes/integracoes.module";
import { SessoesFormacaoController } from "./sessoes-formacao.controller";
import { SessoesFormacaoService } from "./sessoes-formacao.service";

@Module({
  imports: [NotificacoesModule, LmsModule, AssiduidadeModule, forwardRef(() => IntegracoesModule)],
  controllers: [SessoesFormacaoController],
  providers: [SessoesFormacaoService],
  exports: [SessoesFormacaoService],
})
export class SessoesFormacaoModule {}
