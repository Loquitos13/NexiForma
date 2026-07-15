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
import { Public } from "../auth/decorators/public.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { RequestUser } from "../auth/types/access-token-payload";
import { BillingService } from "./billing.service";
import { BillingEntitlementsService } from "./billing-entitlements.service";

@Controller("billing")
export class BillingController {
  constructor(
    private readonly billing: BillingService,
    private readonly entitlements: BillingEntitlementsService,
  ) {}

  @Get("plans")
  listPlans(): Promise<Record<string, unknown>[]> {
    return this.billing.listPlans();
  }

  @Get("entitlements")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("tenant_manager", "comercial", "formador", "formando")
  async entitlementsMe(@CurrentUser() user: RequestUser) {
    const tenantId = user.tenantId;
    if (!tenantId) {
      return { exempt: true };
    }
    return this.entitlements.forTenant(tenantId);
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

  @Public()
  @Post("webhook/stripe")
  stripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers("stripe-signature") signature: string | undefined,
  ) {
    const raw = req.rawBody ?? Buffer.from("");
    return this.billing.handleStripeWebhook(raw, signature);
  }
}
