import { Module } from "@nestjs/common";
import { ViesModule } from "../vies/vies.module";
import { EntidadesClienteController } from "./entidades-cliente.controller";
import { EntidadesClienteService } from "./entidades-cliente.service";

@Module({
  imports: [ViesModule],
  controllers: [EntidadesClienteController],
  providers: [EntidadesClienteService],
  exports: [EntidadesClienteService],
})
export class EntidadesClienteModule {}
