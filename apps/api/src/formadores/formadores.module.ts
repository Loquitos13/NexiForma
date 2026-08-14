import { Module } from "@nestjs/common";
import { StorageModule } from "../storage/storage.module";
import { UsersModule } from "../users/users.module";
import { ViesModule } from "../vies/vies.module";
import { NotificacoesModule } from "../notificacoes/notificacoes.module";
import { FormadoresController } from "./formadores.controller";
import { FormadoresService } from "./formadores.service";

@Module({
  imports: [StorageModule, UsersModule, ViesModule, NotificacoesModule],
  controllers: [FormadoresController],
  providers: [FormadoresService],
  exports: [FormadoresService],
})
export class FormadoresModule {}
