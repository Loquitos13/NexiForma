import { Module } from "@nestjs/common";
import { MailModule } from "../mail/mail.module";
import { BillingController } from "./billing.controller";
import { BillingService } from "./billing.service";
import { BillingEntitlementsService } from "./billing-entitlements.service";

@Module({
  imports: [MailModule],
  controllers: [BillingController],
  providers: [BillingService, BillingEntitlementsService],
  exports: [BillingEntitlementsService],
})
export class BillingModule {}
