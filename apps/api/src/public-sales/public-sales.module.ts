import { Module } from "@nestjs/common";
import { MailModule } from "../mail/mail.module";
import { PublicSalesController } from "./public-sales.controller";
import { PublicSalesService } from "./public-sales.service";

@Module({
  imports: [MailModule],
  controllers: [PublicSalesController],
  providers: [PublicSalesService],
})
export class PublicSalesModule {}
