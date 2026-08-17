import { Module } from "@nestjs/common";
import { CommonModule } from "../common/common.module";
import { NotificacoesModule } from "../notificacoes/notificacoes.module";
import { StorageModule } from "../storage/storage.module";
import { MatriculasController } from "./matriculas.controller";
import { MatriculasService } from "./matriculas.service";

@Module({
  imports: [CommonModule, NotificacoesModule, StorageModule],
  controllers: [MatriculasController],
  providers: [MatriculasService],
})
export class MatriculasModule {}
