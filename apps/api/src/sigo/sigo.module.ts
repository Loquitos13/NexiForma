import { Module, forwardRef } from "@nestjs/common";
import { DossiePedagogicoModule } from "../dossie-pedagogico/dossie-pedagogico.module";
import { NotificacoesModule } from "../notificacoes/notificacoes.module";
import { SigoController } from "./sigo.controller";
import { SigoIntegrationService } from "./sigo-integration.service";
import { SigoCertificatesService } from "./sigo-certificates.service";
import { SigoSchedulerService } from "./sigo-scheduler.service";
import { SigoTenantConfigService } from "./sigo-tenant-config.service";
import { SigoAccessService } from "./sigo-access.service";

import { SigoSoapService } from "./sigo-soap.service";

@Module({
  imports: [DossiePedagogicoModule, forwardRef(() => NotificacoesModule)],
  controllers: [SigoController],
  providers: [
    SigoIntegrationService,
    SigoCertificatesService,
    SigoSchedulerService,
    SigoTenantConfigService,
    SigoAccessService,
    SigoSoapService,
  ],
  exports: [SigoCertificatesService, SigoIntegrationService, SigoTenantConfigService, SigoAccessService],
})
export class SigoModule {}
