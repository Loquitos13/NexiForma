import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { IntegracoesModule } from "../integracoes/integracoes.module";
import { NotificacoesModule } from "../notificacoes/notificacoes.module";
import { MailModule } from "../mail/mail.module";
import { SupportModule } from "../support/support.module";
import { FaturasModule } from "../faturas/faturas.module";
import { BackupModule } from "../backup/backup.module";
import { ControlPlaneController } from "./control-plane.controller";
import { ControlPlaneOpsController } from "./control-plane-ops.controller";
import { ControlPlaneSupportController } from "./control-plane-support.controller";
import { ControlPlaneService } from "./control-plane.service";
import { ControlPlaneOpsService } from "./control-plane-ops.service";
import { ExternalServicesStatusService } from "./external-services-status.service";
import { ControlPlaneTenantOpsService } from "./control-plane-tenant-ops.service";
import { ControlPlaneOpsSchedulerService } from "./control-plane-ops-scheduler.service";
import { ImpersonationService } from "./impersonation.service";
import { TenantAccessKeyService } from "./tenant-access-key.service";

@Module({
  imports: [
    AuthModule,
    IntegracoesModule,
    NotificacoesModule,
    MailModule,
    SupportModule,
    FaturasModule,
    BackupModule,
  ],
  controllers: [
    ControlPlaneController,
    ControlPlaneOpsController,
    ControlPlaneSupportController,
  ],
  providers: [
    ControlPlaneService,
    ControlPlaneOpsService,
    ExternalServicesStatusService,
    ControlPlaneTenantOpsService,
    ControlPlaneOpsSchedulerService,
    ImpersonationService,
    TenantAccessKeyService,
  ],
  exports: [ControlPlaneService, ControlPlaneOpsService],
})
export class ControlPlaneModule {}
