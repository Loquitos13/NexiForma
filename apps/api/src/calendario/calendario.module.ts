import { Module } from "@nestjs/common";
import { CommonModule } from "../common/common.module";
import { NotificacoesModule } from "../notificacoes/notificacoes.module";
import { CalendarioController } from "./calendario.controller";
import { CalendarioService } from "./calendario.service";
import { CalendarioNotificacoesService } from "./calendario-notificacoes.service";
import { CalendarioSchedulerService } from "./calendario-scheduler.service";

@Module({
  imports: [CommonModule, NotificacoesModule],
  controllers: [CalendarioController],
  providers: [CalendarioService, CalendarioNotificacoesService, CalendarioSchedulerService],
  exports: [CalendarioNotificacoesService],
})
export class CalendarioModule {}
