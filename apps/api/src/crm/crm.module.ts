import { Module } from "@nestjs/common";
import { CrmController } from "./crm.controller";
import { CrmService } from "./crm.service";
import { ProposalService } from "./proposal.service";
import { LeadsService } from "./leads.service";
import { TrainerManagementService } from "./trainer-management.service";
import { PrismaModule } from "../prisma/prisma.module";
import { MailModule } from "../mail/mail.module";
import { NotificacoesModule } from "../notificacoes/notificacoes.module";

@Module({
  imports: [PrismaModule, MailModule, NotificacoesModule],
  controllers: [CrmController],
  providers: [CrmService, ProposalService, LeadsService, TrainerManagementService],
  exports: [CrmService, ProposalService, LeadsService, TrainerManagementService],
})
export class CrmModule {}
