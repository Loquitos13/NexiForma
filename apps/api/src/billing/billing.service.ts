import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Stripe from "stripe";

type StripeClient = InstanceType<typeof Stripe>;
type StripeEvent = StripeClient extends { webhooks: { constructEvent: (...args: never[]) => infer E } }
  ? E
  : never;
type StripeCheckoutSession = {
  metadata?: Record<string, string | undefined>;
  customer?: string | null;
  subscription?: string | null;
  customer_email?: string | null;
};
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/types/access-token-payload";
import { requireTenantId } from "../common/tenant-scope";
import { MailService } from "../mail/mail.service";
import { findCurrentTenantSubscription } from "./current-subscription.util";

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private stripe: StripeClient | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
  ) {
    const key = this.config.get<string>("STRIPE_SECRET_KEY");
    if (key) {
      this.stripe = new Stripe(key);
    } else {
      this.logger.warn("STRIPE_SECRET_KEY ausente - checkout indisponível até configurar Stripe.");
    }
  }

  async getSubscription(user: RequestUser): Promise<Record<string, unknown>> {
    const tenantId = requireTenantId(user);
    const sub = await findCurrentTenantSubscription(this.prisma, tenantId);
    if (!sub) {
      return { status: "none", plan: null, planCode: null };
    }
    return {
      status: sub.status,
      plan: sub.plan,
      planCode: sub.plan.code,
      currentPeriodEnd: sub.currentPeriodEnd,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      billingEmail: sub.billingEmail,
    };
  }

  listPlans(): Promise<Record<string, unknown>[]> {
    return this.prisma.subscriptionPlan.findMany({
      where: { active: true, code: { not: "modular" } },
      orderBy: { priceCentsMonthly: "asc" },
    });
  }

  async createCheckout(user: RequestUser, planCode: string) {
    const tenantId = requireTenantId(user);
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { code: planCode },
    });
    if (!plan?.active) {
      throw new NotFoundException("Plano não encontrado.");
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { slug: true, legalName: true },
    });
    if (!tenant) {
      throw new NotFoundException("Tenant não encontrado.");
    }

    const appUrl = this.config.get<string>("APP_PUBLIC_URL") ?? "http://localhost:3000";
    const successUrl = `${appUrl}/portal/billing?success=1`;
    const cancelUrl = `${appUrl}/portal/billing?cancel=1`;

    if (!this.stripe) {
      throw new BadRequestException(
        "Pagamentos não configurados - configure STRIPE_SECRET_KEY e price IDs.",
      );
    }

    let sub = await findCurrentTenantSubscription(this.prisma, tenantId);

    let customerId = sub?.externalCustomerId ?? undefined;
    if (!customerId) {
      const customer = await this.stripe.customers.create({
        email: user.email,
        name: tenant.legalName,
        metadata: { tenantId, tenantSlug: tenant.slug },
      });
      customerId = customer.id;
    }

    const priceId = this.stripePriceForPlan(plan.code);
    if (!priceId) {
      throw new BadRequestException(
        `Configure STRIPE_PRICE_${plan.code.toUpperCase()} para checkout Stripe.`,
      );
    }

    const session = await this.stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { tenantId, planId: plan.id },
    });

    return { mode: "stripe", sessionId: session.id, url: session.url };
  }

  async handleStripeWebhook(rawBody: Buffer, signature: string | undefined) {
    if (!this.stripe) {
      throw new BadRequestException("Stripe não configurado.");
    }
    const secret = this.config.get<string>("STRIPE_WEBHOOK_SECRET");
    if (!secret) {
      throw new BadRequestException("STRIPE_WEBHOOK_SECRET em falta.");
    }

    let event: StripeEvent;
    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature ?? "", secret);
    } catch {
      throw new BadRequestException("Assinatura webhook inválida.");
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as StripeCheckoutSession;
      const tenantId = session.metadata?.tenantId;
      const planId = session.metadata?.planId;
      if (tenantId && planId) {
        await this.activatePaidSubscription(
          tenantId,
          planId,
          session.customer as string,
          session.subscription as string | undefined,
        );
        if (session.customer_email) {
          await this.mail.send({
            to: session.customer_email,
            subject: "NexiForma – subscrição activa",
            text: "A tua subscrição NexiForma foi activada com sucesso.",
          });
        }
      }
    }

    return { received: true };
  }

  private stripePriceForPlan(code: string): string | undefined {
    return this.config.get<string>(`STRIPE_PRICE_${code.toUpperCase()}`);
  }

  private async activateTrialSubscription(tenantId: string, planId: string, email: string) {
    const now = new Date();
    const end = new Date(now);
    end.setMonth(end.getMonth() + 1);

    const existingId = await this.findSubId(tenantId);
    if (existingId) {
      await this.prisma.tenantSubscription.update({
        where: { id: existingId },
        data: {
          planId,
          status: "ACTIVE",
          currentPeriodStart: now,
          currentPeriodEnd: end,
          billingEmail: email,
        },
      });
    } else {
      await this.prisma.tenantSubscription.create({
        data: {
          tenantId,
          planId,
          status: "ACTIVE",
          currentPeriodStart: now,
          currentPeriodEnd: end,
          billingEmail: email,
        },
      });
    }

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { status: "ACTIVE" },
    });
  }

  private async activatePaidSubscription(
    tenantId: string,
    planId: string,
    customerId: string,
    subscriptionId?: string,
  ) {
    const now = new Date();
    const end = new Date(now);
    end.setMonth(end.getMonth() + 1);

    const existingId = await this.findSubId(tenantId);
    if (existingId) {
      await this.prisma.tenantSubscription.update({
        where: { id: existingId },
        data: {
          planId,
          status: "ACTIVE",
          externalCustomerId: customerId,
          currentPeriodStart: now,
          currentPeriodEnd: end,
        },
      });
    } else {
      await this.prisma.tenantSubscription.create({
        data: {
          tenantId,
          planId,
          status: "ACTIVE",
          externalCustomerId: customerId,
          currentPeriodStart: now,
          currentPeriodEnd: end,
        },
      });
    }

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { status: "ACTIVE" },
    });

    this.logger.log(`Subscrição activa tenant=${tenantId} stripe=${subscriptionId ?? "n/a"}`);
  }

  private async findSubId(tenantId: string): Promise<string | null> {
    const s = await findCurrentTenantSubscription(this.prisma, tenantId);
    return s?.id ?? null;
  }
}
