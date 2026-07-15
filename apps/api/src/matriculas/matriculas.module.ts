import { Module } from "@nestjs/common";
import { NotificacoesModule } from "../notificacoes/notificacoes.module";
import { MatriculasController } from "./matriculas.controller";
import { MatriculasService } from "./matriculas.service";

@Module({
  imports: [NotificacoesModule],
  controllers: [MatriculasController],
  providers: [MatriculasService],
})
export class MatriculasModule {}
