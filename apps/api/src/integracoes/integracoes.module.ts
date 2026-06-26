import { Module, forwardRef } from "@nestjs/common";
import { IntegracoesController } from "./integracoes.controller";
import { IntegracoesService } from "./integracoes.service";
import { SessoesFormacaoModule } from "../sessoes-formacao/sessoes-formacao.module";

@Module({
  imports: [forwardRef(() => SessoesFormacaoModule)],
  controllers: [IntegracoesController],
  providers: [IntegracoesService],
  exports: [IntegracoesService],
})
export class IntegracoesModule {}
