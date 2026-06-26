import { Module } from "@nestjs/common";
import { ComplianceModule } from "../compliance/compliance.module";
import { CertificadosModule } from "../certificados/certificados.module";
import { NotificacoesController } from "./notificacoes.controller";
import { NotificacoesService } from "./notificacoes.service";
import { NotificacoesExtendedService } from "./notificacoes-extended.service";
import { PortalNotificacoesService } from "./portal-notificacoes.service";
import { PushService } from "./push.service";
import { SmsService } from "./sms.service";

@Module({
  imports: [ComplianceModule, CertificadosModule],
  controllers: [NotificacoesController],
  providers: [NotificacoesService, NotificacoesExtendedService, PortalNotificacoesService, PushService, SmsService],
  exports: [NotificacoesService, NotificacoesExtendedService, PortalNotificacoesService, PushService, SmsService],
})
export class NotificacoesModule {}
