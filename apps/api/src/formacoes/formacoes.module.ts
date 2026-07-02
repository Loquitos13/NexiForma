import { Module } from "@nestjs/common";
import { NotificacoesModule } from "../notificacoes/notificacoes.module";
import { StorageModule } from "../storage/storage.module";
import { FormacoesController } from "./formacoes.controller";
import { FormacoesWebsiteController } from "./formacoes-website.controller";
import { FormacoesService } from "./formacoes.service";
import { FormacoesCatalogService } from "./formacoes-catalog.service";
import { FormacoesPublishService } from "./formacoes-publish.service";

@Module({
  imports: [StorageModule, NotificacoesModule],
  controllers: [FormacoesWebsiteController, FormacoesController],
  providers: [FormacoesService, FormacoesCatalogService, FormacoesPublishService],
  exports: [FormacoesService, FormacoesCatalogService, FormacoesPublishService],
})
export class FormacoesModule {}