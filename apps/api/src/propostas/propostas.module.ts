import { Module } from "@nestjs/common";
import { CrmModule } from "../crm/crm.module";
import { PropostasController } from "./propostas.controller";
import { PropostasService } from "./propostas.service";

@Module({
  imports: [CrmModule],
  controllers: [PropostasController],
  providers: [PropostasService],
  exports: [PropostasService],
})
export class PropostasModule {}
