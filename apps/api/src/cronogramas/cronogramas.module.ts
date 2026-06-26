import { Module } from "@nestjs/common";
import { StorageModule } from "../storage/storage.module";
import { CronogramasController } from "./cronogramas.controller";
import { CronogramasService } from "./cronogramas.service";
import { CronogramaHtmlExportService } from "./cronograma-html-export.service";
import { CronogramaArquivoService } from "./cronograma-arquivo.service";

@Module({
  imports: [StorageModule],
  controllers: [CronogramasController],
  providers: [CronogramasService, CronogramaHtmlExportService, CronogramaArquivoService],
  exports: [CronogramasService, CronogramaHtmlExportService, CronogramaArquivoService],
})
export class CronogramasModule {}
