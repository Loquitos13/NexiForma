import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { PropostaEstado } from "@nexiforma/database";
import { PrismaService } from "../prisma/prisma.service";
import { MailService } from "../mail/mail.service";
import { EmailTemplates } from "./templates/email.templates";
import { PortalNotificacoesService } from "./portal-notificacoes.service";
import { resolverEmailUtilizador } from "@nexiforma/shared";
import { resolveAppPublicUrlForLinks } from "../common/app-public-url.util";
import {
  GESTOR_E_COORD_COMERCIAL_ROLES,
  resolverEmailNotificacaoUtilizador,
} from "./notificacao-roles.util";

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
    const notaCliente = motivo?.trim() || undefined;
    const portalMensagem = notaCliente
      ? `${proposta.titulo} - ${estadoLabel}. Nota do cliente: ${notaCliente}`
      : `${proposta.titulo} - ${estadoLabel}`;
    const portalMensagemGestor =
      estadoNovo === "ACEITE"
        ? `${portalMensagem}. Complete o registo do cliente na ficha CRM.`
        : portalMensagem;

    // Gestor + coordenador comercial (sem duplicar o comercial que enviou).
    const gestao = await this.prisma.user.findMany({
      where: { tenantId, active: true, role: { in: GESTOR_E_COORD_COMERCIAL_ROLES } },
      select: { id: true, email: true, displayName: true, role: true },
    });
    const notificados = new Set<string>();

    for (const g of gestao) {
      const to = resolverEmailNotificacaoUtilizador(g.role, g.email);
      const tpl = EmailTemplates.propostaEstadoGestor({
        gestorNome: g.displayName,
        codigo: proposta.codigo,
        titulo: proposta.titulo,
        cliente: proposta.entidadeCliente.nome,
        estado: estadoEmail,
        motivo: notaCliente,
        portalUrl,
      });
      await this.portal.notifyUser({
        tenantId,
        userId: g.id,
        tipo: "proposta_estado",
        titulo: `Proposta ${proposta.codigo} ${estadoLabel}`,
        mensagem: portalMensagemGestor.slice(0, 280),
        link: portalLink,
        email: to ? { to, subject: tpl.subject, text: tpl.text, html: tpl.html } : undefined,
        push: {
          title: `Proposta ${proposta.codigo} ${estadoLabel}`,
          body: portalMensagem.slice(0, 160),
          url: portalUrl,
        },
      });
      notificados.add(g.id);
    }

    // Comercial que enviou a proposta (se ainda não notificado como gestor/coord).
    const comercial = proposta.enviadaPor;
    if (comercial && !notificados.has(comercial.id)) {
      const to = resolverEmailUtilizador(comercial.email);
      if (to || comercial.id) {
        const tpl = EmailTemplates.propostaEstadoComercial({
          comercialNome: comercial.displayName,
          codigo: proposta.codigo,
          titulo: proposta.titulo,
          cliente: proposta.entidadeCliente.nome,
          estado: estadoEmail,
          motivo: notaCliente,
          portalUrl,
        });
        await this.portal.notifyUser({
          tenantId,
          userId: comercial.id,
          tipo: "proposta_estado",
          titulo: `Proposta ${proposta.codigo} ${estadoLabel}`,
          mensagem: portalMensagemGestor.slice(0, 280),
          link: portalLink,
          email: to
            ? { to, subject: tpl.subject, text: tpl.text, html: tpl.html }
            : undefined,
          push: {
            title: `Proposta ${proposta.codigo} ${estadoLabel}`,
            body: portalMensagem.slice(0, 160),
            url: portalUrl,
          },
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
        motivo: notaCliente,
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
