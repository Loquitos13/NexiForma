import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { IntegracoesModule } from "../integracoes/integracoes.module";
import { ControlPlaneController } from "./control-plane.controller";
import { ControlPlaneService } from "./control-plane.service";
import { ImpersonationService } from "./impersonation.service";

@Module({
  imports: [AuthModule, IntegracoesModule],
  controllers: [ControlPlaneController],
  providers: [ControlPlaneService, ImpersonationService],
  exports: [ControlPlaneService],
})
export class ControlPlaneModule {}
