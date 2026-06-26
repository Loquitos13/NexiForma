import { Module } from "@nestjs/common";
import { DossiePedagogicoModule } from "../dossie-pedagogico/dossie-pedagogico.module";
import { SigoController } from "./sigo.controller";
import { SigoIntegrationService } from "./sigo-integration.service";

@Module({
  imports: [DossiePedagogicoModule],
  controllers: [SigoController],
  providers: [SigoIntegrationService],
})
export class SigoModule {}
