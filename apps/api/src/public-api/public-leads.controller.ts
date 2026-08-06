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
import { Public } from "../auth/decorators/public.decorator";
import { LeadsService } from "../crm/leads.service";
import { CrmConfigService } from "../crm/crm-config.service";
import { PublicCreateLeadDto } from "../crm/dto/public-lead.dto";
import { ApiKeyGuard, type ApiKeyRequest } from "./api-key.guard";
import { PrismaService } from "../prisma/prisma.service";
import { verifyLeadWebhookSignature } from "@nexiforma/shared";

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
      throw new UnauthorizedException("Pedido não autorizado.");
    }

    const cfg = await this.config.getByTenantId(tenant.id);
    const secret = cfg.leadWebhookSecret?.trim();
    if (!secret) {
      throw new UnauthorizedException("Pedido não autorizado.");
    }

    const signInput = {
      empresaNome: dto.empresaNome,
      contactoNome: dto.contactoNome,
      email: dto.email,
      telefone: dto.telefone,
      nif: dto.nif,
      origem: dto.origem,
      valorEstimadoCentavos: dto.valorEstimadoCentavos,
      notas: dto.notas,
      customFields: dto.customFields,
    };

    if (!verifyLeadWebhookSignature(secret, signature, signInput)) {
      throw new UnauthorizedException("Pedido não autorizado.");
    }

    return this.leads.createFromPublic(tenant.id, dto, {
      source: "website_webhook",
      origem: dto.origem ?? "WEBSITE",
    });
  }
}
