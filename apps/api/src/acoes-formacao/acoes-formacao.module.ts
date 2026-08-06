import { Module } from "@nestjs/common";
import { NotificacoesModule } from "../notificacoes/notificacoes.module";
import { StorageModule } from "../storage/storage.module";
import { CommonModule } from "../common/common.module";
import { AuditModule } from "../audit/audit.module";
import { ComplianceModule } from "../compliance/compliance.module";
import { AcoesFormacaoController } from "./acoes-formacao.controller";
import { AcoesFormacaoService } from "./acoes-formacao.service";

@Module({
  imports: [NotificacoesModule, StorageModule, CommonModule, AuditModule, ComplianceModule],
  controllers: [AcoesFormacaoController],
  providers: [AcoesFormacaoService],
})
export class AcoesFormacaoModule {}
