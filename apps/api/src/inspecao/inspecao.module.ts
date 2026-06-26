/**
 * Inspection Module – NexiForma Fase 8
 */

import { Module } from "@nestjs/common";
import { InspecaoController } from "./inspecao.controller";
import { InspecaoPacoteService } from "./inspecao-pacote.service";
import { PrismaModule } from "../prisma/prisma.module";
import { DossiePedagogicoModule } from "../dossie-pedagogico/dossie-pedagogico.module";

@Module({
  imports: [PrismaModule, DossiePedagogicoModule],
  controllers: [InspecaoController],
  providers: [InspecaoPacoteService],
  exports: [InspecaoPacoteService],
})
export class InspecaoModule {}
