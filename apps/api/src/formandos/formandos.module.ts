import { Module } from "@nestjs/common";
import { StorageModule } from "../storage/storage.module";
import { ViesModule } from "../vies/vies.module";
import { NotificacoesModule } from "../notificacoes/notificacoes.module";
import { UsersModule } from "../users/users.module";
import { FormandosController } from "./formandos.controller";
import { FormandosService } from "./formandos.service";
import { FormandoPortalController } from "./formando-portal.controller";
import { FormandoPortalService } from "./formando-portal.service";

@Module({
  imports: [StorageModule, ViesModule, NotificacoesModule, UsersModule],
  controllers: [FormandosController, FormandoPortalController],
  providers: [FormandosService, FormandoPortalService],
})
export class FormandosModule {}
