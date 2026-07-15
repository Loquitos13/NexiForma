import { Body, Controller, Get, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Public } from "../auth/decorators/public.decorator";
import { PublicSalesService } from "./public-sales.service";
import { SalesContactDto } from "./dto/sales-contact.dto";

@Public()
@Controller("public")
export class PublicSalesController {
  constructor(private readonly sales: PublicSalesService) {}

  @Get("billing/catalog")
  billingCatalog() {
    return this.sales.getBillingCatalog();
  }

  @Post("vendas/contacto")
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  vendasContacto(@Body() dto: SalesContactDto) {
    return this.sales.registerSalesLead(dto);
  }
}
