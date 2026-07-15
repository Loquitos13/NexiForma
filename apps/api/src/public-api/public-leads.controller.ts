import {
  Body,
  Controller,
  Headers,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { createHmac, timingSafeEqual } from "crypto";
import { Public } from "../auth/decorators/public.decorator";
import { LeadsService } from "../crm/leads.service";
import { CrmConfigService } from "../crm/crm-config.service";
import { PublicCreateLeadDto } from "../crm/dto/public-lead.dto";
import { ApiKeyGuard, type ApiKeyRequest } from "./api-key.guard";
import { PrismaService } from "../prisma/prisma.service";

type ReqWithKey = { apiKey: ApiKeyRequest };

@Public()
@Controller("public/v1")
export class PublicLeadsController {
  constructor(
    private readonly leads: LeadsService,
    private readonly config: CrmConfigService,
    private readonly prisma: PrismaService,
  ) {}

  /** Criar lead via chave API (Zapier, Make, site custom). */
  @Post("leads")
  @UseGuards(ApiKeyGuard)
  createViaApiKey(@Req() req: ReqWithKey, @Body() dto: PublicCreateLeadDto) {
    return this.leads.createFromPublic(req.apiKey.tenantId, dto, { source: "api_key" });
  }

  /** Webhook HMAC para formulários do website (sem API key). */
  @Post("webhooks/leads/:tenantSlug")
  async createViaWebhook(
    @Param("tenantSlug") tenantSlug: string,
    @Body() dto: PublicCreateLeadDto,
    @Headers("x-nexiforma-signature") signature?: string,
  ) {
    const tenant = await this.prisma.tenant.findFirst({
      where: { slug: tenantSlug },
      select: { id: true },
    });
    if (!tenant) {
      throw new UnauthorizedException("Tenant inválido.");
    }

    const cfg = await this.config.getByTenantId(tenant.id);
    const secret = cfg.leadWebhookSecret?.trim();
    if (!secret) {
      throw new UnauthorizedException("Webhook de leads não configurado.");
    }

    const secretHeader = signature?.replace(/^sha256=/, "") ?? "";
    const payload = `${dto.empresaNome}|${dto.email ?? ""}|${dto.telefone ?? ""}`;
    const expected = createHmac("sha256", secret).update(payload).digest("hex");

    if (!secretHeader || !this.safeEqual(secretHeader, expected)) {
      throw new UnauthorizedException("Assinatura HMAC inválida.");
    }

    return this.leads.createFromPublic(tenant.id, dto, {
      source: "website_webhook",
      origem: dto.origem ?? "WEBSITE",
    });
  }

  private safeEqual(a: string, b: string): boolean {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  }
}
