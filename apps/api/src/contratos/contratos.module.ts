import { Module } from "@nestjs/common";
import { StorageModule } from "../storage/storage.module";
import { ContratosController } from "./contratos.controller";
import { ContratosService } from "./contratos.service";

@Module({
  imports: [StorageModule],
  controllers: [ContratosController],
  providers: [ContratosService],
  exports: [ContratosService],
})
export class ContratosModule {}
