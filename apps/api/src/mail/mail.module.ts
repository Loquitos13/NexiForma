import { Global, Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { MailController } from "./mail.controller";
import { MailWebhookService } from "./mail-webhook.service";
import { MailService } from "./mail.service";

@Global()
@Module({
  imports: [PrismaModule],
  controllers: [MailController],
  providers: [MailService, MailWebhookService],
  exports: [MailService, MailWebhookService],
})
export class MailModule {}
