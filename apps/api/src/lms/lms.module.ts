import { Module } from "@nestjs/common";
import { CommonModule } from "../common/common.module";
import { LmsController } from "./lms.controller";
import { LmsService } from "./lms.service";

@Module({
  imports: [CommonModule],
  controllers: [LmsController],
  providers: [LmsService],
  exports: [LmsService],
})
export class LmsModule {}
