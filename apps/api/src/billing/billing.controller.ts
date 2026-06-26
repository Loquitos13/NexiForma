import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { RawBodyRequest } from "@nestjs/common";
import type { Request } from "express";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { RequestUser } from "../auth/types/access-token-payload";
import { BillingService } from "./billing.service";

@Controller("billing")
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get("plans")
  listPlans(): Promise<Record<string, unknown>[]> {
    return this.billing.listPlans();
  }

  @Get("subscription")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("tenant_manager")
  subscription(@CurrentUser() user: RequestUser): Promise<Record<string, unknown>> {
    return this.billing.getSubscription(user);
  }

  @Post("checkout")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("tenant_manager")
  checkout(@CurrentUser() user: RequestUser, @Body() body: { planCode: string }) {
    return this.billing.createCheckout(user, body.planCode);
  }

  @Post("webhook/stripe")
  stripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers("stripe-signature") signature: string | undefined,
  ) {
    const raw = req.rawBody ?? Buffer.from("");
    return this.billing.handleStripeWebhook(raw, signature);
  }
}
