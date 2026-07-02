import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { BILLING_CATALOG } from "@nexiforma/shared";
import { PrismaService } from "../prisma/prisma.service";
import { MailService } from "../mail/mail.service";
import type { SalesContactDto } from "./dto/sales-contact.dto";

@Injectable()
export class PublicSalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  getBillingCatalog() {
    return BILLING_CATALOG;
  }

  async registerSalesLead(dto: SalesContactDto) {
    const lead = await this.prisma.platformSalesLead.create({
      data: {
        nome: dto.nome.trim(),
        email: dto.email.trim().toLowerCase(),
        empresa: dto.empresa?.trim() || null,
        telefone: dto.telefone?.trim() || null,
        planoInteresse: dto.planoInteresse ?? null,
        addonsInteresse: dto.addonsInteresse?.length ? dto.addonsInteresse : undefined,
        mensagem: dto.mensagem?.trim() || null,
        origem: dto.origem?.trim() || "welcome",
      },
    });

    const inbox =
      this.config.get<string>("PLATFORM_SALES_EMAIL") ??
      this.config.get<string>("MAIL_REPLY_TO") ??
      this.config.get<string>("MAIL_FROM");

    if (inbox) {
      const addons =
        dto.addonsInteresse?.length ? dto.addonsInteresse.join(", ") : "-";
      const body = [
        `Novo pedido de contacto comercial (#${lead.id})`,
        "",
        `Nome: ${lead.nome}`,
        `Email: ${lead.email}`,
        `Empresa: ${lead.empresa ?? "-"}`,
        `Telefone: ${lead.telefone ?? "-"}`,
        `Plano: ${lead.planoInteresse ?? "-"}`,
        `Add-ons: ${addons}`,
        `Origem: ${lead.origem}`,
        "",
        "Mensagem:",
        lead.mensagem ?? "-",
      ].join("\n");

      await this.mail.send({
        to: inbox,
        subject: `[NexiForma] Novo lead comercial - ${lead.nome}`,
        text: body,
        html: body.replace(/\n/g, "<br>"),
      });
    }

    return { ok: true, id: lead.id };
  }
}
