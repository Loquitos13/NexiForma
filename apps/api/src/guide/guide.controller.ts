import { Body, Controller, Get, Post, Query, Req, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import type { JwtRole } from "@nexiforma/shared";
import { Public } from "../auth/decorators/public.decorator";
import { OptionalJwtAuthGuard } from "../auth/guards/optional-jwt-auth.guard";
import type { RequestUser } from "../auth/types/access-token-payload";
import { BillingEntitlementsService } from "../billing/billing-entitlements.service";
import { GuideChatDto } from "./dto/guide-chat.dto";
import { GuideService } from "./guide.service";

type ReqWithUser = Request & { user?: RequestUser | null };

@Public()
@Controller("guide")
export class GuideController {
  constructor(
    private readonly guide: GuideService,
    private readonly entitlements: BillingEntitlementsService,
  ) {}

  private async resolveEntitlements(user?: RequestUser | null) {
    if (!user?.tenantId || user.role === "super_admin") return null;
    return this.entitlements.forTenant(user.tenantId);
  }

  @Public()
  @Post("chat")
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @UseGuards(OptionalJwtAuthGuard)
  async chat(@Body() dto: GuideChatDto, @Req() req: ReqWithUser) {
    const role = (req.user?.role ?? null) as JwtRole | null;
    const ent = await this.resolveEntitlements(req.user);
    return this.guide.chat(dto.message.trim(), dto.pathname, role, dto.history, ent);
  }

  @Public()
  @Get("search")
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @UseGuards(OptionalJwtAuthGuard)
  async search(
    @Query("q") q: string | undefined,
    @Query("pathname") pathname: string | undefined,
    @Req() req: ReqWithUser,
  ) {
    const role = (req.user?.role ?? null) as JwtRole | null;
    const ent = await this.resolveEntitlements(req.user);
    return this.guide.search(q ?? "", pathname ?? "/portal", role, ent, req.user);
  }
}
