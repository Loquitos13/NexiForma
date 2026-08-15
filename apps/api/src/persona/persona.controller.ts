import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UnauthorizedException,
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
import { PersonaService } from "./persona.service";
import { ConfigService } from "@nestjs/config";
import { createHmac, timingSafeEqual } from "node:crypto";

@Controller("persona")
export class PersonaController {
  constructor(
    private readonly persona: PersonaService,
    private readonly config: ConfigService,
  ) {}

  @Get("config")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("formando", "formador")
  getConfig() {
    return this.persona.getPublicConfig();
  }

  @Post("inquiries")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("formando", "formador")
  createInquiry(@CurrentUser() user: RequestUser) {
    return this.persona.createInquiry(user);
  }

  @Get("inquiries/me")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("formando", "formador")
  getLatest(@CurrentUser() user: RequestUser) {
    return this.persona.getLatestInquiry(user);
  }

  @Post("inquiries/:personaInquiryId/sync")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("formando", "formador")
  syncInquiry(
    @CurrentUser() user: RequestUser,
    @Param("personaInquiryId") personaInquiryId: string,
  ) {
    return this.persona.syncInquiry(user, personaInquiryId);
  }

  @Public()
  @Post("webhooks")
  webhook(@Req() req: RawBodyRequest<Request>, @Body() body: Record<string, unknown>) {
    this.verifyWebhook(req);
    return this.persona.handleWebhookEvent(body);
  }

  private verifyWebhook(req: RawBodyRequest<Request>) {
    const secret = this.config.get<string>("PERSONA_WEBHOOK_SECRET")?.trim();
    if (!secret) return;

    const signature = req.headers["persona-signature"];
    if (typeof signature !== "string" || !signature.length) {
      throw new UnauthorizedException("Persona-Signature em falta.");
    }

    const raw = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
    const parts = signature.split(",").reduce<Record<string, string>>((acc, part) => {
      const [k, v] = part.split("=");
      if (k && v) acc[k.trim()] = v.trim();
      return acc;
    }, {});

    const timestamp = parts.t;
    const digest = parts.v1;
    if (!timestamp || !digest) throw new UnauthorizedException("Assinatura Persona inválida.");

    const signed = `${timestamp}.${raw.toString("utf8")}`;
    const expected = createHmac("sha256", secret).update(signed).digest("hex");
    const a = Buffer.from(digest, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException("Assinatura Persona inválida.");
    }
  }
}
