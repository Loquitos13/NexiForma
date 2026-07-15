import { Module } from "@nestjs/common";
import { MailModule } from "../mail/mail.module";
import { SupportTicketsController, PublicSupportTicketsController } from "./support-tickets.controller";
import { SupportTicketsService } from "./support-tickets.service";

@Module({
  imports: [MailModule],
  controllers: [SupportTicketsController, PublicSupportTicketsController],
  providers: [SupportTicketsService],
  exports: [SupportTicketsService],
})
export class SupportModule {}
