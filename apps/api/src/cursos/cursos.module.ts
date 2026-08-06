import { Module } from "@nestjs/common";
import { NotificacoesModule } from "../notificacoes/notificacoes.module";
import { CatalogoUfcdModule } from "../catalogo-ufcd/catalogo-ufcd.module";
import { CursosController } from "./cursos.controller";
import { CursosService } from "./cursos.service";

@Module({
  imports: [NotificacoesModule, CatalogoUfcdModule],
  controllers: [CursosController],
  providers: [CursosService],
})
export class CursosModule {}
