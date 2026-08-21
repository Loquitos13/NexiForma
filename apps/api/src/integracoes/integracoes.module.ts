import { Module, forwardRef } from "@nestjs/common";
import { IntegracoesController } from "./integracoes.controller";
import { IntegracoesService } from "./integracoes.service";
import { IntegracoesSchedulerService } from "./integracoes-scheduler.service";
import { TeamsTranscriptService } from "./teams-transcript.service";
import { TeamsTranscriptSchedulerService } from "./teams-transcript-scheduler.service";
import { SessoesFormacaoModule } from "../sessoes-formacao/sessoes-formacao.module";
import { BillingModule } from "../billing/billing.module";

@Module({
  imports: [forwardRef(() => SessoesFormacaoModule), BillingModule],
  controllers: [IntegracoesController],
  providers: [
    IntegracoesService,
    IntegracoesSchedulerService,
    TeamsTranscriptService,
    TeamsTranscriptSchedulerService,
  ],
  exports: [IntegracoesService, TeamsTranscriptService],
})
export class IntegracoesModule {}
