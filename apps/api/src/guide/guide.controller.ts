import { Body, Controller, Get, Post, Query, Req, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import type { JwtRole } from "@nexiforma/shared";
import { OptionalJwtAuthGuard } from "../auth/guards/optional-jwt-auth.guard";
import type { RequestUser } from "../auth/types/access-token-payload";
import { GuideChatDto } from "./dto/guide-chat.dto";
import { GuideService } from "./guide.service";

type ReqWithUser = Request & { user?: RequestUser | null };

@Controller("guide")
export class GuideController {
  constructor(private readonly guide: GuideService) {}

  @Post("chat")
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @UseGuards(OptionalJwtAuthGuard)
  chat(@Body() dto: GuideChatDto, @Req() req: ReqWithUser) {
    const role = (req.user?.role ?? null) as JwtRole | null;
    return this.guide.chat(dto.message.trim(), dto.pathname, role, dto.history);
  }

  @Get("search")
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @UseGuards(OptionalJwtAuthGuard)
  search(
    @Query("q") q: string | undefined,
    @Query("pathname") pathname: string | undefined,
    @Req() req: ReqWithUser,
  ) {
    const role = (req.user?.role ?? null) as JwtRole | null;
    return this.guide.search(q ?? "", pathname ?? "/portal", role);
  }
}
