import { Module } from "@nestjs/common";
import { StorageModule } from "../storage/storage.module";
import { RgpdController } from "./rgpd.controller";
import { RgpdService } from "./rgpd.service";

@Module({
  imports: [StorageModule],
  controllers: [RgpdController],
  providers: [RgpdService],
})
export class RgpdModule {}
