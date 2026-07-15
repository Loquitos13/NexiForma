import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Public } from "../auth/decorators/public.decorator";
import { apiStrictLimitPerMin, DDOS_WINDOW_MS } from "../common/ddos-throttle.config";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { RequestUser } from "../auth/types/access-token-payload";
import { SupportTicketsService } from "./support-tickets.service";
import { CreateSupportTicketDto } from "./dto/support.dto";

@Controller("public/support")
@Throttle({ default: { limit: apiStrictLimitPerMin(), ttl: DDOS_WINDOW_MS } })
export class PublicSupportTicketsController {
  constructor(private readonly tickets: SupportTicketsService) {}

  @Public()
  @Post("tickets")
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  createPublic(@Body() dto: CreateSupportTicketDto) {
    return this.tickets.create(dto);
  }
}

@Controller("support")
export class SupportTicketsController {
  constructor(private readonly tickets: SupportTicketsService) {}

  @Get("tickets")
  listPortal(@CurrentUser() user: RequestUser, @Query("limit") limit?: string) {
    return this.tickets.listForPortalUser(user, limit ? Number(limit) : 50);
  }

  @Get("tickets/:id")
  getPortal(@CurrentUser() user: RequestUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.tickets.getOneForPortalUser(user, id);
  }

  @Post("tickets")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  createAuthenticated(@CurrentUser() user: RequestUser, @Body() dto: CreateSupportTicketDto) {
    return this.tickets.create(dto, user);
  }
}
