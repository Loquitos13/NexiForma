import { Module } from "@nestjs/common";
import { NotificacoesModule } from "../notificacoes/notificacoes.module";
import { CursosController } from "./cursos.controller";
import { CursosService } from "./cursos.service";

@Module({
  imports: [NotificacoesModule],
  controllers: [CursosController],
  providers: [CursosService],
})
export class CursosModule {}
