import { Module, forwardRef } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { ComplianceModule } from "../compliance/compliance.module";
import { CertificadosModule } from "../certificados/certificados.module";
import { NotificacoesController } from "./notificacoes.controller";
import { NotificacoesService } from "./notificacoes.service";
import { NotificacoesExtendedService } from "./notificacoes-extended.service";
import { NotificacoesSchedulerService } from "./notificacoes-scheduler.service";
import { PortalNotificacoesService } from "./portal-notificacoes.service";
import { PropostaNotificacoesService } from "./proposta-notificacoes.service";
import { PlatformAlertasService } from "./platform-alertas.service";
import { PlatformTenantNotificacoesService } from "./platform-tenant-notificacoes.service";
import { PushService } from "./push.service";
import { SmsService } from "./sms.service";

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ComplianceModule,
    forwardRef(() => CertificadosModule),
  ],
  controllers: [NotificacoesController],
  providers: [
    NotificacoesService,
    NotificacoesExtendedService,
    NotificacoesSchedulerService,
    PortalNotificacoesService,
    PropostaNotificacoesService,
    PlatformAlertasService,
    PlatformTenantNotificacoesService,
    PushService,
    SmsService,
  ],
  exports: [
    NotificacoesService,
    NotificacoesExtendedService,
    PortalNotificacoesService,
    PropostaNotificacoesService,
    PlatformAlertasService,
    PlatformTenantNotificacoesService,
    PushService,
    SmsService,
  ],
})
export class NotificacoesModule {}
