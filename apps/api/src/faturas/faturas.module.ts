import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { NotificacoesModule } from "../notificacoes/notificacoes.module";
import { MailModule } from "../mail/mail.module";
import { FaturasController } from "./faturas.controller";
import { AtFaturasIntegrationService } from "./at-faturas-integration.service";
import { FaturaHtmlExportService } from "./fatura-html-export.service";
import { FaturasService } from "./faturas.service";

@Module({
  imports: [PrismaModule, NotificacoesModule, MailModule],
  controllers: [FaturasController],
  providers: [FaturasService, FaturaHtmlExportService, AtFaturasIntegrationService],
  exports: [FaturasService],
})
export class FaturasModule {}
