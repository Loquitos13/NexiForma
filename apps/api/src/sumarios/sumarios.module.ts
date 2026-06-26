import { Module } from "@nestjs/common";
import { CmdModule } from "../cmd/cmd.module";
import { SumariosController } from "./sumarios.controller";
import { SumariosService } from "./sumarios.service";

@Module({
  imports: [CmdModule],
  controllers: [SumariosController],
  providers: [SumariosService],
})
export class SumariosModule {}
