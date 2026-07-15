import { Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { MailModule } from "../mail/mail.module";
import { BillingController } from "./billing.controller";
import { BillingService } from "./billing.service";
import { BillingEntitlementsService } from "./billing-entitlements.service";
import { BillingAccessInterceptor } from "./billing-access.interceptor";

@Module({
  imports: [MailModule],
  controllers: [BillingController],
  providers: [
    BillingService,
    BillingEntitlementsService,
    BillingAccessInterceptor,
    {
      provide: APP_INTERCEPTOR,
      useClass: BillingAccessInterceptor,
    },
  ],
  exports: [BillingEntitlementsService],
})
export class BillingModule {}
