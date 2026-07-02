import { Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { resolverEmailNotificacaoFormando } from "@nexiforma/shared";
import { PrismaService } from "../prisma/prisma.service";
import { MailService } from "../mail/mail.service";
import { ComplianceAlertasService } from "../compliance/compliance-alertas.service";
import { CertificadosService } from "../certificados/certificados.service";
import type { RequestUser } from "../auth/types/access-token-payload";
import { requireTenantId } from "../common/tenant-scope";
import { SmsService } from "./sms.service";
import {
  GESTOR_ROLES,
  resolverEmailNotificacaoUtilizador,
} from "./notificacao-roles.util";

@Injectable()
export class NotificacoesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
    private readonly sms: SmsService,
    private readonly alertas: ComplianceAlertasService,
    private readonly certificados: CertificadosService,
  ) {}

  getConfig() {
    const delivery = this.mail.getDeliveryStatus();

    return {
      email: {
        enabled: delivery.sendsRealEmail,
        provider: delivery.provider,
        mode: delivery.mode,
        sendsRealEmail: delivery.sendsRealEmail,
        from: delivery.from,
        replyTo: delivery.replyTo,
        aviso: delivery.aviso,
        dnsChecklist: delivery.dnsChecklist,
        sesRegion: delivery.sesRegion,
        smtpHost: delivery.smtpHost,
      },
      sms: {
        enabled: this.sms.isEnabled(),
        provider: this.sms.getProvider(),
      },
      appPublicUrl: this.config.get<string>("APP_PUBLIC_URL") ?? "http://localhost:3000",
    };
  }

  async enviarDigestAlertas(user: RequestUser) {
    const tenantId = requireTenantId(user);
    return this.enviarDigestAlertasTenant(tenantId);
  }

  async enviarDigestAlertasTenant(tenantId: string) {
    const { alertas } = await this.alertas.listAlertasForTenant(tenantId, 50);

    const destinatarios = await this.prisma.user.findMany({
      where: {
        tenantId,
        active: true,
        role: { in: [...GESTOR_ROLES, "FORMADOR"] },
      },
      select: {
        email: true,
        displayName: true,
        role: true,
        formadorProfile: { select: { email: true } },
      },
    });

    const emailsUnicos = new Map<string, string>();
    for (const d of destinatarios) {
      const to = resolverEmailNotificacaoUtilizador(
        d.role,
        d.email,
        d.formadorProfile?.email,
      );
      if (to) emailsUnicos.set(to, d.displayName);
    }

    if (!emailsUnicos.size) {
      return { enviados: 0, alertas: alertas.length, destinatarios: [] };
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { legalName: true, slug: true },
    });

    const appUrl = this.config.get<string>("APP_PUBLIC_URL") ?? "http://localhost:3000";
    const linhas =
      alertas.length === 0
        ? ["Sem alertas activos neste momento."]
        : alertas.map(
            (a) =>
              `[${a.severidade === "critico" ? "CRÍTICO" : "AVISO"}] ${a.codigoInterno}: ${a.mensagem}`,
          );

    const text =
      `Resumo de alertas NexiForma – ${tenant?.legalName ?? "entidade formadora"}\n\n` +
      linhas.join("\n") +
      `\n\nConsulta o portal: ${appUrl}/portal`;

    const html =
      `<p>Resumo de alertas para <strong>${tenant?.legalName ?? "a entidade"}</strong>:</p>` +
      (alertas.length
        ? `<ul>${alertas
            .map(
              (a) =>
                `<li><strong>${a.codigoInterno}</strong> (${a.severidade}): ${a.mensagem}</li>`,
            )
            .join("")}</ul>`
        : `<p>Sem alertas activos.</p>`) +
      `<p><a href="${appUrl}/portal">Abrir portal</a></p>`;

    for (const [to] of emailsUnicos) {
      await this.mail.send({
        to,
        subject: `NexiForma – ${alertas.length} alerta(s) operacionais`,
        text,
        html,
      });
    }

    return {
      enviados: emailsUnicos.size,
      alertas: alertas.length,
      destinatarios: [...emailsUnicos.keys()],
    };
  }

  async enviarLembretesSessao(user: RequestUser, acaoId?: string) {
    const tenantId = requireTenantId(user);
    return this.enviarLembretesSessaoTenant(tenantId, acaoId);
  }

  async enviarLembretesSessaoTenant(tenantId: string, acaoId?: string) {
    const now = new Date();
    const amanhaInicio = new Date(now);
    amanhaInicio.setDate(amanhaInicio.getDate() + 1);
    amanhaInicio.setHours(0, 0, 0, 0);
    const amanhaFim = new Date(amanhaInicio);
    amanhaFim.setHours(23, 59, 59, 999);

    const sessoes = await this.prisma.sessaoFormacao.findMany({
      where: {
        tenantId,
        estado: "AGENDADA",
        data: { gte: amanhaInicio, lte: amanhaFim },
        cronograma: {
          acaoFormacao: acaoId ? { id: acaoId, tenantId } : { tenantId },
        },
      },
      include: {
        cronograma: {
          include: {
            acaoFormacao: { select: { codigoInterno: true, titulo: true } },
          },
        },
      },
    });

    const appUrl = this.config.get<string>("APP_PUBLIC_URL") ?? "http://localhost:3000";
    let emailsEnviados = 0;
    let smsEnviados = 0;
    const detalhes: string[] = [];

    for (const sessao of sessoes) {
      const acao = sessao.cronograma.acaoFormacao;
      const matriculas = await this.prisma.matricula.findMany({
        where: {
          tenantId,
          estado: "ATIVA",
          turma: { acaoFormacaoId: sessao.cronograma.acaoFormacaoId },
        },
        include: {
          formando: {
            select: {
              nome: true,
              email: true,
              telefone: true,
              userId: true,
              user: { select: { email: true } },
            },
          },
        },
      });

      const dataStr = sessao.data.toLocaleDateString("pt-PT");
      const horaStr = sessao.horaInicio ?? "";

      for (const m of matriculas) {
        const email = resolverEmailNotificacaoFormando({
          emailContacto: m.formando.email,
          emailConta: m.formando.user?.email,
        });
        if (!email) continue;

        const text =
          `Olá ${m.formando.nome},\n\n` +
          `Lembrete: amanhã (${dataStr}) tens a sessão ${sessao.numeroSessao} da formação «${acao.titulo}» (${acao.codigoInterno}).` +
          (horaStr ? `\nHora: ${horaStr}` : "") +
          `\n\nAcede ao portal: ${appUrl}/portal/formando`;

        await this.mail.send({
          to: email,
          subject: `Sessão amanhã – ${acao.codigoInterno}`,
          text,
          html:
            `<p>Olá <strong>${m.formando.nome}</strong>,</p>` +
            `<p>Amanhã (<strong>${dataStr}</strong>) tens a <strong>sessão ${sessao.numeroSessao}</strong> ` +
            `da formação «${acao.titulo}».</p>` +
            `<p><a href="${appUrl}/portal/formando">Abrir portal formando</a></p>`,
        });
        emailsEnviados += 1;

        if (m.formando.telefone && this.sms.isEnabled()) {
          await this.sms.send({
            to: m.formando.telefone,
            body: `NexiForma: sessão ${sessao.numeroSessao} amanhã (${dataStr}) – ${acao.codigoInterno}.`,
          });
          smsEnviados += 1;
        }

        detalhes.push(`${m.formando.nome} – S${sessao.numeroSessao} ${dataStr}`);
      }
    }

    return {
      sessoes: sessoes.length,
      emailsEnviados,
      smsEnviados,
      detalhes,
    };
  }

  async enviarCertificadosDisponiveis(user: RequestUser, acaoId: string) {
    const tenantId = requireTenantId(user);
    const acao = await this.prisma.acaoFormacao.findFirst({
      where: { id: acaoId, tenantId },
      select: { id: true },
    });
    if (!acao) {
      throw new NotFoundException("Acção não encontrada.");
    }

    const lista = await this.certificados.listByAcao(user, acaoId);
    const elegiveis = lista.formandos.filter((f) => f.elegivelCertificado);
    const appUrl = this.config.get<string>("APP_PUBLIC_URL") ?? "http://localhost:3000";

    let enviados = 0;
    for (const f of elegiveis) {
      const email = resolverEmailNotificacaoFormando({
        emailContacto: f.formando.email,
        emailConta: f.formando.user?.email,
      });
      if (!email) continue;

      await this.mail.send({
        to: email,
        subject: `Certificado disponível – ${lista.acao.codigoInterno}`,
        text:
          `Olá ${f.formando.nome},\n\n` +
          `O teu certificado da formação «${lista.acao.titulo}» está disponível.\n` +
          `Consulta em: ${appUrl}/portal/certificados`,
        html:
          `<p>Olá <strong>${f.formando.nome}</strong>,</p>` +
          `<p>O teu certificado da formação «${lista.acao.titulo}» está disponível.</p>` +
          `<p><a href="${appUrl}/portal/certificados">Ver certificados</a></p>`,
      });
      enviados += 1;
    }

    return {
      acaoId,
      elegiveis: elegiveis.length,
      enviados,
    };
  }
}
