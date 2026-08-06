import { Module } from "@nestjs/common";
import { StorageModule } from "../storage/storage.module";
import { FormadoresController } from "./formadores.controller";
import { FormadoresService } from "./formadores.service";

@Module({
  imports: [StorageModule],
  controllers: [FormadoresController],
  providers: [FormadoresService],
  exports: [FormadoresService],
})
export class FormadoresModule {}
