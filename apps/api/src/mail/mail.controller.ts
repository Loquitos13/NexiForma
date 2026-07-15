import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { Public } from "../auth/decorators/public.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { MailService } from "./mail.service";
import { MailWebhookService } from "./mail-webhook.service";

@Controller("mail")
export class MailController {
  constructor(
    private readonly mail: MailService,
    private readonly webhooks: MailWebhookService,
  ) {}

  /** Webhook SNS para bounces/complaints AWS SES (sem JWT). */
  @Public()
  @Post("webhooks/ses")
  sesSnsWebhook(@Body() body: Record<string, unknown>) {
    return this.webhooks.handleSesSns(body as never);
  }

  @Get("status")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("tenant_manager")
  async status() {
    const delivery = this.mail.getDeliveryStatus();
    const stats = await this.webhooks.deliveryStats();
    return { ...delivery, stats };
  }

  @Get("eventos")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("tenant_manager")
  eventos(): Promise<unknown> {
    return this.webhooks.listRecentEventos(50);
  }
}
