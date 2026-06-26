import { Module } from "@nestjs/common";
import { ComplianceModule } from "../compliance/compliance.module";
import { CronogramasModule } from "../cronogramas/cronogramas.module";
import { DossiePedagogicoController } from "./dossie-pedagogico.controller";
import { DossieHtmlExportService } from "./dossie-html-export.service";
import { DossiePedagogicoService } from "./dossie-pedagogico.service";
import { SigoExportService } from "./sigo-export.service";
import { DossieArquivoService } from "./dossie-arquivo.service";
import { InspecaoPacoteService } from "./inspecao-pacote.service";

@Module({
  imports: [ComplianceModule, CronogramasModule],
  controllers: [DossiePedagogicoController],
  providers: [
    DossiePedagogicoService,
    SigoExportService,
    DossieHtmlExportService,
    DossieArquivoService,
    InspecaoPacoteService,
  ],
  exports: [DossiePedagogicoService, SigoExportService, InspecaoPacoteService],
})
export class DossiePedagogicoModule {}