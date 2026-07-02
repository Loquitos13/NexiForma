/**
 * Extended Notification Service – NexiForma Fase 8
 * Métodos adicionais com templates de email/SMS
 * Este arquivo estende NotificacoesService com novas funcionalidades
 */

import { Injectable, Logger } from "@nestjs/common";
import { MailService } from "../mail/mail.service";
import { SmsService } from "./sms.service";
import { PrismaService } from "../prisma/prisma.service";
import { ConfigService } from "@nestjs/config";
import { EmailTemplates } from "./templates/email.templates";
import { SmsTemplates } from "./templates/sms.templates";
import {
  resolverEmailNotificacaoFormando,
  resolverEmailNotificacaoFormador,
  resolverEmailPresencaFormando,
} from "@nexiforma/shared";
import {
  GESTOR_COORDENADOR_ROLES,
  GESTOR_ROLES,
  resolverEmailNotificacaoUtilizador,
} from "./notificacao-roles.util";

@Injectable()
export class NotificacoesExtendedService {
  private readonly logger = new Logger(NotificacoesExtendedService.name);

  constructor(
    private readonly mail: MailService,
    private readonly sms: SmsService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Notificar formando sobre nova sessão agendada
   */
  async notificarSessaoAgendada(
    email: string,
    nomeFormando: string,
    sessionData: {
      nomeSessao: string;
      dataHora: string;
      localidade: string;
      formador: string;
      telefone?: string;
    },
  ) {
    const portalUrl =
      this.config.get<string>("APP_PUBLIC_URL") ?? "http://localhost:3000";

    // Email
    const emailTemplate = EmailTemplates.sessaoAgendada({
      nomeFormando,
      nomeSessao: sessionData.nomeSessao,
      dataHora: sessionData.dataHora,
      localidade: sessionData.localidade,
      formador: sessionData.formador,
      portalUrl: `${portalUrl}/portal/formando`,
    });

    await this.mail.send({
      to: email,
      subject: emailTemplate.subject,
      text: emailTemplate.text,
      html: emailTemplate.html,
    });

    // SMS (se telefone disponível)
    if (sessionData.telefone && this.sms.isEnabled()) {
      const smsBody = SmsTemplates.confirmacaoSessao({
        nomeSessao: sessionData.nomeSessao,
        data: sessionData.dataHora.split(" ")[0],
        hora: sessionData.dataHora.split(" ")[1] ?? "TBD",
      });

      await this.sms.send({
        to: sessionData.telefone,
        body: smsBody,
      });
    }

    this.logger.log(
      `✓ Notificação sessão enviada para ${nomeFormando} (${email})`,
    );
  }

  /**
   * Avisar formandos e formador quando a sessão é iniciada.
   */
  async enviarSessaoIniciada(tenantId: string, sessaoId: string) {
    const sessao = await this.prisma.sessaoFormacao.findFirst({
      where: { id: sessaoId, tenantId },
      include: {
        formador: {
          select: {
            nomeCompleto: true,
            email: true,
            user: { select: { email: true } },
          },
        },
        cronograma: {
          select: {
            acaoFormacao: { select: { id: true, titulo: true } },
          },
        },
      },
    });
    if (!sessao) {
      this.logger.warn(`Sessão ${sessaoId} não encontrada para notificação.`);
      return { enviados: 0 };
    }

    const acao = sessao.cronograma.acaoFormacao;
    const portalBase =
      this.config.get<string>("APP_PUBLIC_URL") ?? "http://localhost:3000";
    const dataPt = sessao.data.toLocaleDateString("pt-PT", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const dataHora = `${dataPt} · ${sessao.horaInicio}–${sessao.horaFim}`;
    const nomeSessao = `Sessão ${sessao.numeroSessao}`;
    const formadorNome = sessao.formador?.nomeCompleto ?? "A definir";
    const salaUrl = sessao.salaJoinUrl;

    const matriculas = await this.prisma.matricula.findMany({
      where: {
        tenantId,
        estado: { not: "DESISTENCIA" },
        turma: { acaoFormacaoId: acao.id },
      },
      select: {
        id: true,
        formando: {
          select: {
            nome: true,
            email: true,
            emailPresenca: true,
            user: { select: { email: true } },
          },
        },
      },
    });

    let enviados = 0;

    for (const m of matriculas) {
      const email = resolverEmailNotificacaoFormando({
        emailContacto: m.formando.email,
        emailConta: m.formando.user?.email,
      });
      if (!email) continue;

      const emailReuniao = resolverEmailPresencaFormando({
        emailPresenca: m.formando.emailPresenca,
        emailConta: m.formando.user?.email,
        emailContacto: m.formando.email,
      });

      const reuniaoQs = new URLSearchParams({
        matriculaId: m.id,
        sessaoFormacaoId: sessaoId,
      });
      const portalFormando = `${portalBase}/portal/formando/reuniao?${reuniaoQs.toString()}`;

      const tpl = EmailTemplates.sessaoIniciada({
        nomeDestinatario: m.formando.nome,
        nomeSessao,
        acaoTitulo: acao.titulo,
        dataHora,
        formador: formadorNome,
        portalUrl: portalFormando,
        salaUrl,
        emailReuniao,
        audiencia: "formando",
      });

      await this.mail.send({
        to: email,
        subject: tpl.subject,
        text: tpl.text,
        html: tpl.html,
      });
      enviados += 1;
    }

    const staffEmails = new Map<string, string>();

    const formadorEmail = sessao.formador
      ? resolverEmailNotificacaoFormador({
          emailPerfil: sessao.formador.email,
          emailConta: sessao.formador.user?.email,
        })
      : null;
    if (formadorEmail && sessao.formador) {
      staffEmails.set(formadorEmail, sessao.formador.nomeCompleto);
    }

    for (const [email, nome] of staffEmails) {
      const tpl = EmailTemplates.sessaoIniciada({
        nomeDestinatario: nome,
        nomeSessao,
        acaoTitulo: acao.titulo,
        dataHora,
        formador: formadorNome,
        portalUrl: `${portalBase}/portal/lms`,
        salaUrl,
        audiencia: "staff",
      });

      await this.mail.send({
        to: email,
        subject: tpl.subject,
        text: tpl.text,
        html: tpl.html,
      });
      enviados += 1;
    }

    this.logger.log(
      `✓ Sessão iniciada: ${enviados} notificação(ões) enviada(s) (${sessaoId})`,
    );

    return { enviados };
  }

  /**
   * Avisar formador (e gestores) quando formando entra na reunião com email incorrecto.
   */
  async notificarEmailReuniaoIncorreto(
    tenantId: string,
    sessaoId: string,
    matriculaId: string,
    emailEsperado: string,
    emailParticipante: string,
  ) {
    const sessao = await this.prisma.sessaoFormacao.findFirst({
      where: { id: sessaoId, tenantId },
      include: {
        formador: {
          select: {
            nomeCompleto: true,
            email: true,
            user: { select: { email: true } },
          },
        },
      },
    });
    if (!sessao) return { enviados: 0 };

    const matricula = await this.prisma.matricula.findFirst({
      where: { id: matriculaId, tenantId },
      select: { formando: { select: { nome: true } } },
    });
    if (!matricula) return { enviados: 0 };

    const portalBase =
      this.config.get<string>("APP_PUBLIC_URL") ?? "http://localhost:3000";
    const nomeSessao = `Sessão ${sessao.numeroSessao}`;
    const portalUrl = `${portalBase}/portal/acoes`;

    const destinatarios = new Map<string, string>();
    if (sessao.formador) {
      const formadorEmail = resolverEmailNotificacaoFormador({
        emailPerfil: sessao.formador.email,
        emailConta: sessao.formador.user?.email,
      });
      if (formadorEmail) {
        destinatarios.set(formadorEmail, sessao.formador.nomeCompleto);
      }
    }

    const gestores = await this.prisma.user.findMany({
      where: { tenantId, active: true, role: { in: GESTOR_COORDENADOR_ROLES } },
      select: { email: true, displayName: true, role: true },
    });
    for (const g of gestores) {
      const to = resolverEmailNotificacaoUtilizador(g.role, g.email);
      if (to) destinatarios.set(to, g.displayName);
    }

    let enviados = 0;
    for (const [email, nome] of destinatarios) {
      const tpl = EmailTemplates.alertaEmailReuniaoIncorreto({
        nomeFormador: nome,
        nomeFormando: matricula.formando.nome,
        nomeSessao,
        emailEsperado,
        emailParticipante,
        portalUrl,
      });
      await this.mail.send({
        to: email,
        subject: tpl.subject,
        text: tpl.text,
        html: tpl.html,
      });
      enviados += 1;
    }

    if (enviados > 0) {
      this.logger.warn(
        `Email reunião incorrecto: ${matricula.formando.nome} (${emailParticipante} ≠ ${emailEsperado})`,
      );
    }

    return { enviados };
  }

  /**
   * Notificar formando sobre certificado disponível
   */
  async notificarCertificadoDisponivel(
    email: string,
    nomeFormando: string,
    certificadoData: {
      nomeCurso: string;
      codigoFormacao: string;
      telefone?: string;
      dataExpiracao?: string;
    },
  ) {
    const portalUrl =
      this.config.get<string>("APP_PUBLIC_URL") ?? "http://localhost:3000";

    // Email
    const emailTemplate = EmailTemplates.certificadoDisponivel({
      nomeFormando,
      nomeCurso: certificadoData.nomeCurso,
      codigoFormacao: certificadoData.codigoFormacao,
      dataExpiracao: certificadoData.dataExpiracao,
      portalUrl: `${portalUrl}/portal/certificados`,
    });

    await this.mail.send({
      to: email,
      subject: emailTemplate.subject,
      text: emailTemplate.text,
      html: emailTemplate.html,
    });

    // SMS (se telefone disponível)
    if (certificadoData.telefone && this.sms.isEnabled()) {
      const smsBody = SmsTemplates.certificadoDisponivel({
        nomeCurso: certificadoData.nomeCurso,
        portal: `${portalUrl}/cert`,
      });

      await this.sms.send({
        to: certificadoData.telefone,
        body: smsBody,
      });
    }

    this.logger.log(
      `✓ Notificação certificado enviada para ${nomeFormando} (${email})`,
    );
  }

  /**
   * Notificar administrador sobre alerta de compliance
   */
  async notificarAlertaCompliance(
    tenantId: string,
    alertaData: {
      severidade: "critico" | "aviso";
      mensagem: string;
      detalhes?: string;
    },
  ) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { legalName: true, metadata: true },
    });

    type TenantAlertMeta = {
      alertSmsPhone?: string;
      alertTelegramChatId?: string;
    };
    const meta = (tenant?.metadata ?? {}) as TenantAlertMeta;

    const admins = await this.prisma.user.findMany({
      where: {
        tenantId,
        active: true,
        role: { in: GESTOR_ROLES },
      },
      select: { email: true, displayName: true, role: true },
    });

    const portalUrl =
      this.config.get<string>("APP_PUBLIC_URL") ?? "http://localhost:3000";

    const emailTemplate = EmailTemplates.alertaCompliance({
      entidade: tenant?.legalName ?? "Entidade",
      severidade: alertaData.severidade,
      mensagem: alertaData.mensagem,
      detalhes: alertaData.detalhes,
      portalUrl: `${portalUrl}/portal/alertas`,
    });

    for (const admin of admins) {
      const to = resolverEmailNotificacaoUtilizador(admin.role, admin.email);
      if (!to) continue;

      await this.mail.send({
        to,
        subject: emailTemplate.subject,
        text: emailTemplate.text,
        html: emailTemplate.html,
      });

      // SMS/Telegram (apenas alertas críticos) – número ou chat_id no metadata do tenant
      if (alertaData.severidade === "critico" && this.sms.isEnabled()) {
        const smsBody = SmsTemplates.alertaCritico({
          entidade: tenant?.legalName ?? "entidade",
          mensagem: alertaData.mensagem,
        });

        const destino =
          this.sms.getProvider() === "telegram"
            ? meta.alertTelegramChatId
            : meta.alertSmsPhone;

        if (destino) {
          await this.sms.send({ to: destino, body: smsBody });
        }
      }

      this.logger.log(
        `✓ Alerta ${alertaData.severidade} notificado para ${admin.displayName}`,
      );
    }

    return { adminsSMSenviados: admins.length };
  }

  /**
   * Notificar sobre convite de acesso
   */
  async notificarConviteAcesso(
    email: string,
    nomeUtilizador: string,
    convidoData: {
      entidadeFormadora: string;
      papel: string;
      linkConvite: string;
      expiraEm: string;
    },
  ) {
    const emailTemplate = EmailTemplates.convitePortal({
      nomeUtilizador,
      entidadeFormadora: convidoData.entidadeFormadora,
      papel: convidoData.papel,
      linkConvite: convidoData.linkConvite,
      expiraEm: convidoData.expiraEm,
    });

    await this.mail.send({
      to: email,
      subject: emailTemplate.subject,
      text: emailTemplate.text,
      html: emailTemplate.html,
    });

    this.logger.log(
      `✓ Convite enviado para ${nomeUtilizador} (${email}) – válido até ${convidoData.expiraEm}`,
    );
  }

  /**
   * Notificar sobre resumo de inspeção DGERT
   */
  async notificarResumoInspecao(
    tenantId: string,
    inspecaoData: {
      totalAcoes: number;
      acoesProntas: number;
      alertas: string[];
    },
  ) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { legalName: true },
    });

    const coordenadores = await this.prisma.user.findMany({
      where: {
        tenantId,
        active: true,
        role: { in: GESTOR_COORDENADOR_ROLES },
      },
      select: { email: true, displayName: true, role: true },
    });

    const portalUrl =
      this.config.get<string>("APP_PUBLIC_URL") ?? "http://localhost:3000";

    const emailTemplate = EmailTemplates.resumoInspecao({
      entidade: tenant?.legalName ?? "Entidade",
      totalAcoes: inspecaoData.totalAcoes,
      acoesProntas: inspecaoData.acoesProntas,
      alerta: inspecaoData.alertas,
      portalUrl: `${portalUrl}/portal/inspecao`,
    });

    for (const coordenador of coordenadores) {
      const to = resolverEmailNotificacaoUtilizador(coordenador.role, coordenador.email);
      if (!to) continue;

      await this.mail.send({
        to,
        subject: emailTemplate.subject,
        text: emailTemplate.text,
        html: emailTemplate.html,
      });

      this.logger.log(
        `✓ Resumo inspeção enviado para ${coordenador.displayName}`,
      );
    }

    return { coordenadoresNotificados: coordenadores.length };
  }

  /**
   * Avisar formador sobre CC/CCP a expirar ou expirado (email do perfil/conta).
   */
  async notificarFormadorQualificacao(
    email: string,
    nomeFormador: string,
    mensagem: string,
    severidade: "critico" | "aviso",
  ) {
    const portalUrl =
      this.config.get<string>("APP_PUBLIC_URL") ?? "http://localhost:3000";
    const emailTemplate = EmailTemplates.alertaCompliance({
      entidade: "A sua qualificação",
      severidade,
      mensagem,
      portalUrl: `${portalUrl}/portal/formadores`,
    });

    await this.mail.send({
      to: email,
      subject: emailTemplate.subject,
      text: emailTemplate.text.replace("Entidade:", "Formador:"),
      html: emailTemplate.html,
    });

    this.logger.log(`✓ Alerta qualificação enviado a ${nomeFormador} (${email})`);
  }
}
