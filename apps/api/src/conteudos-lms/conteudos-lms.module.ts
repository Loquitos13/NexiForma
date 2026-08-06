import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { NotificacoesModule } from "../notificacoes/notificacoes.module";
import { ConteudosLmsController } from "./conteudos-lms.controller";
import { ScormAssetsController } from "./scorm-assets.controller";
import { ConteudosLmsService } from "./conteudos-lms.service";
import { ConteudosLmsPrazoSchedulerService } from "./conteudos-lms-prazo-scheduler.service";
import { ScormService } from "./scorm.service";
import { ScormPackageService } from "./scorm-package.service";
import { ScormAssetAuthService } from "./scorm-asset-auth.service";

@Module({
  imports: [AuthModule, NotificacoesModule],
  controllers: [ConteudosLmsController, ScormAssetsController],
  providers: [
    ConteudosLmsService,
    ConteudosLmsPrazoSchedulerService,
    ScormService,
    ScormPackageService,
    ScormAssetAuthService,
  ],
  exports: [ConteudosLmsService, ScormService],
})
export class ConteudosLmsModule {}
