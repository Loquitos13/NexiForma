import { Module } from "@nestjs/common";
import { BillingModule } from "../billing/billing.module";
import { GuideController } from "./guide.controller";
import { GuideLlmService } from "./guide-llm.service";
import { GuideService } from "./guide.service";
import { PortalEntitySearchService } from "./portal-entity-search.service";

@Module({
  imports: [BillingModule],
  controllers: [GuideController],
  providers: [GuideService, GuideLlmService, PortalEntitySearchService],
})
export class GuideModule {}
