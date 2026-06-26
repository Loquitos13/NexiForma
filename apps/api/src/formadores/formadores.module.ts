import { Module } from "@nestjs/common";
import { FormadoresController } from "./formadores.controller";
import { FormadoresService } from "./formadores.service";

@Module({
  controllers: [FormadoresController],
  providers: [FormadoresService],
})
export class FormadoresModule {}
