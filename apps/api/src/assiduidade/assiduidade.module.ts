import { Module } from "@nestjs/common";
import { NotificacoesModule } from "../notificacoes/notificacoes.module";
import { AssiduidadeController } from "./assiduidade.controller";
import { AssiduidadeService } from "./assiduidade.service";

@Module({
  imports: [NotificacoesModule],
  controllers: [AssiduidadeController],
  providers: [AssiduidadeService],
  exports: [AssiduidadeService],
})
export class AssiduidadeModule {}
