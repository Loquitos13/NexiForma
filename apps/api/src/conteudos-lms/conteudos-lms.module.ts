import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ConteudosLmsController } from "./conteudos-lms.controller";
import { ScormAssetsController } from "./scorm-assets.controller";
import { ConteudosLmsService } from "./conteudos-lms.service";
import { ScormService } from "./scorm.service";
import { ScormPackageService } from "./scorm-package.service";
import { ScormAssetAuthService } from "./scorm-asset-auth.service";

@Module({
  imports: [AuthModule],
  controllers: [ConteudosLmsController, ScormAssetsController],
  providers: [
    ConteudosLmsService,
    ScormService,
    ScormPackageService,
    ScormAssetAuthService,
  ],
  exports: [ConteudosLmsService, ScormService],
})
export class ConteudosLmsModule {}
