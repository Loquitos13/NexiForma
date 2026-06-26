import { Module } from "@nestjs/common";
import { EntidadesClienteController } from "./entidades-cliente.controller";
import { EntidadesClienteService } from "./entidades-cliente.service";

@Module({
  controllers: [EntidadesClienteController],
  providers: [EntidadesClienteService],
  exports: [EntidadesClienteService],
})
export class EntidadesClienteModule {}
