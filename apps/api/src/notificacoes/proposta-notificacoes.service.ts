import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { PropostaEstado } from "@nexiforma/database";
import { PrismaService } from "../prisma/prisma.service";
import { MailService } from "../mail/mail.service";
import { EmailTemplates } from "./templates/email.templates";
import { PortalNotificacoesService } from "./portal-notificacoes.service";
import { resolverEmailUtilizador } from "@nexiforma/shared";
import { resolveAppPublicUrlForLinks } from "../common/app-public-url.util";

const ESTADOS_NOTIFICAR: PropostaEstado[] = ["ACEITE", "REJEITADA"];

@Injectable()
export class PropostaNotificacoesService {
  private readonly logger = new Logger(PropostaNotificacoesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly portal: PortalNotificacoesService,
    private readonly mail: MailService,
  ) {}

  async aoAlterarEstado(
    tenantId: string,
    propostaId: string,
    estadoAnterior: PropostaEstado,
    estadoNovo: PropostaEstado,
    motivo?: string,
  ) {
    if (estadoAnterior === estadoNovo || !ESTADOS_NOTIFICAR.includes(estadoNovo)) {
      return { skipped: true };
    }

    const proposta = await this.prisma.propostaComercial.findFirst({
      where: { id: propostaId, tenantId },
      include: {
        entidadeCliente: { select: { nome: true, email: true } },
        tenant: { select: { legalName: true } },
        enviadaPor: { select: { id: true, email: true, displayName: true, role: true } },
      },
    });
    if (!proposta) return { skipped: true };

    const appUrl = resolveAppPublicUrlForLinks(this.config);
    const portalUrl = `${appUrl}/portal/propostas/${propostaId}`;
    const portalLink = `/portal/propostas/${propostaId}`;
    const estadoLabel = estadoNovo === "ACEITE" ? "aceite" : "rejeitada";
    const estadoEmail = estadoNovo as "ACEITE" | "REJEITADA";

    // Gestor + comercial: emails internos com link «Abrir CRM».
    await this.portal.notifyGestores(tenantId, {
      tipo: "proposta_estado",
      titulo: `Proposta ${proposta.codigo} ${estadoLabel}`,
      mensagem: `${proposta.titulo} - ${estadoLabel}`,
      link: portalLink,
      buildEmail: (g) =>
        EmailTemplates.propostaEstadoGestor({
          gestorNome: g.displayName,
          codigo: proposta.codigo,
          titulo: proposta.titulo,
          cliente: proposta.entidadeCliente.nome,
          estado: estadoEmail,
          motivo,
          portalUrl,
        }),
    });

    const comercial = proposta.enviadaPor;
    if (comercial?.role === "COMERCIAL") {
      const to = resolverEmailUtilizador(comercial.email);
      if (to) {
        const tpl = EmailTemplates.propostaEstadoComercial({
          comercialNome: comercial.displayName,
          codigo: proposta.codigo,
          titulo: proposta.titulo,
          cliente: proposta.entidadeCliente.nome,
          estado: estadoEmail,
          motivo,
          portalUrl,
        });
        await this.portal.notifyUser({
          tenantId,
          userId: comercial.id,
          tipo: "proposta_estado",
          titulo: `Proposta ${proposta.codigo} ${estadoLabel}`,
          mensagem: tpl.text.slice(0, 280),
          link: portalLink,
          email: { to, subject: tpl.subject, text: tpl.text, html: tpl.html },
        });
      }
    }

    // Cliente externo: confirmação sem link para o CRM.
    const clienteEmail = proposta.entidadeCliente.email?.trim();
    if (clienteEmail) {
      const tplCliente = EmailTemplates.propostaEstadoCliente({
        clienteNome: proposta.entidadeCliente.nome,
        codigo: proposta.codigo,
        titulo: proposta.titulo,
        entidadeFormadora: proposta.tenant.legalName,
        estado: estadoEmail,
        motivo,
      });
      try {
        await this.mail.send({
          to: clienteEmail,
          subject: tplCliente.subject,
          text: tplCliente.text,
          html: tplCliente.html,
        });
      } catch (err) {
        this.logger.warn(
          `Email confirmação cliente (${proposta.codigo} → ${clienteEmail}): ${String(err)}`,
        );
      }
    }

    this.logger.log(`Proposta ${proposta.codigo} → ${estadoNovo} (notificações enviadas)`);
    return { ok: true };
  }
}
