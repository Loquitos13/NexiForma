import { Module } from "@nestjs/common";
import { CrmController } from "./crm.controller";
import { CrmService } from "./crm.service";
import { ProposalService } from "./proposal.service";
import { LeadsService } from "./leads.service";
import { TrainerManagementService } from "./trainer-management.service";
import { CrmLlmService } from "./crm-llm.service";
import { CrmNotasInsightsService } from "./crm-notas-insights.service";
import { CrmSugestoesExecucaoService } from "./crm-sugestoes-execucao.service";
import { CrmSugestoesIaService } from "./crm-sugestoes-ia.service";
import { CrmInteraccoesService } from "./crm-interaccoes.service";
import { CrmInteraccoesSchedulerService } from "./crm-interaccoes-scheduler.service";
import { CrmAuditService } from "./crm-audit.service";
import { CrmConfigService } from "./crm-config.service";
import { CrmWebhooksService } from "./crm-webhooks.service";
import { CrmAutomationService } from "./crm-automation.service";
import { CrmAutomationSchedulerService } from "./crm-automation-scheduler.service";
import { CrmEmailSyncService } from "./crm-email-sync.service";
import { PrismaModule } from "../prisma/prisma.module";
import { MailModule } from "../mail/mail.module";
import { NotificacoesModule } from "../notificacoes/notificacoes.module";
import { CalendarioModule } from "../calendario/calendario.module";

@Module({
  imports: [PrismaModule, MailModule, NotificacoesModule, CalendarioModule],
  controllers: [CrmController],
  providers: [
    CrmService,
    ProposalService,
    LeadsService,
    TrainerManagementService,
    CrmLlmService,
    CrmNotasInsightsService,
    CrmSugestoesExecucaoService,
    CrmSugestoesIaService,
    CrmInteraccoesService,
    CrmInteraccoesSchedulerService,
    CrmAuditService,
    CrmConfigService,
    CrmWebhooksService,
    CrmAutomationService,
    CrmAutomationSchedulerService,
    CrmEmailSyncService,
  ],
  exports: [
    CrmService,
    ProposalService,
    LeadsService,
    TrainerManagementService,
    CrmInteraccoesService,
    CrmSugestoesIaService,
    CrmConfigService,
    CrmAuditService,
  ],
})
export class CrmModule {}
