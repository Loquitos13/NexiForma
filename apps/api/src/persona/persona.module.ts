import { Module } from "@nestjs/common";
import { StorageModule } from "../storage/storage.module";
import { PersonaController } from "./persona.controller";
import { PersonaService } from "./persona.service";
import { PersonaApiClient } from "./persona-api.client";
import { PersonaDocumentSyncService } from "./persona-document-sync.service";

@Module({
  imports: [StorageModule],
  controllers: [PersonaController],
  providers: [PersonaService, PersonaApiClient, PersonaDocumentSyncService],
  exports: [PersonaService, PersonaApiClient],
})
export class PersonaModule {}
