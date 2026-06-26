import { Module } from "@nestjs/common";
import { CommonModule } from "../common/common.module";
import { StorageModule } from "../storage/storage.module";
import { FolhasPresencaController, PresencasController } from "./folhas-presenca.controller";
import { FolhaPresencaHtmlExportService } from "./folha-presenca-html-export.service";
import { FolhasPresencaService } from "./folhas-presenca.service";

@Module({
  imports: [CommonModule, StorageModule],
  controllers: [FolhasPresencaController, PresencasController],
  providers: [FolhasPresencaService, FolhaPresencaHtmlExportService],
})
export class FolhasPresencaModule {}
