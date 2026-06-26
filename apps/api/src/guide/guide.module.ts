import { Module } from "@nestjs/common";
import { GuideController } from "./guide.controller";
import { GuideLlmService } from "./guide-llm.service";
import { GuideService } from "./guide.service";

@Module({
  controllers: [GuideController],
  providers: [GuideService, GuideLlmService],
})
export class GuideModule {}
