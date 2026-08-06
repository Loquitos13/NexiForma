import { Module } from "@nestjs/common";
import { CommonModule } from "../common/common.module";
import { StorageModule } from "../storage/storage.module";
import { SumariosController } from "./sumarios.controller";
import { SumariosService } from "./sumarios.service";

@Module({
  imports: [CommonModule, StorageModule],
  controllers: [SumariosController],
  providers: [SumariosService],
  exports: [SumariosService],
})
export class SumariosModule {}
