import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { MailService } from "../mail/mail.service";
import { PrismaService } from "../prisma/prisma.service";
import { EmailTemplates } from "./templates/email.templates";
import { PushService } from "./push.service";
import { GESTOR_ROLES, GESTOR_E_COMERCIAL_ROLES, resolverEmailNotificacaoUtilizador } from "./notificacao-roles.util";

export type CriarNotificacaoInput = {
  tenantId: string;
  userId: string;
  tipo: string;
  titulo: string;
  mensagem: string;
  link?: string;
  /** Destinatário explícito (opcional se usar emailConteudo). */
  email?: { to: string; subject: string; text: string; html: string };
  /** Envia para o email da conta do utilizador (User.email). */
  emailConteudo?: { subject: string; text: string; html: string };
  push?: { title: string; body: string; url?: string };
};

@Injectable()
export class PortalNotificacoesService {
  private readonly logger = new Logger(PortalNotificacoesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly push: PushService,
    private readonly config: ConfigService,
  ) {}

  listMine(userId: string, limit = 30) {
    return this.prisma.notificacaoPortal.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  countUnread(userId: string) {
    return this.prisma.notificacaoPortal.count({
      where: { userId, lida: false },
    });
  }

  async markRead(userId: string, id: string) {
    await this.prisma.notificacaoPortal.updateMany({
      where: { id, userId },
      data: { lida: true },
    });
    return { ok: true };
  }

  async markAllRead(userId: string) {
    await this.prisma.notificacaoPortal.updateMany({
      where: { userId, lida: false },
      data: { lida: true },
    });
    return { ok: true };
  }

  async notifyUser(input: CriarNotificacaoInput) {
    const row = await this.prisma.notificacaoPortal.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId,
        tipo: input.tipo,
        titulo: input.titulo,
        mensagem: input.mensagem,
        link: input.link ?? null,
      },
    });

    if (input.email) {
      await this.mail.send({
        to: input.email.to,
        subject: input.email.subject,
        text: input.email.text,
        html: input.email.html,
      });
    } else if (input.emailConteudo) {
      const u = await this.prisma.user.findUnique({
        where: { id: input.userId },
        select: { email: true },
      });
      const to = u?.email?.trim();
      if (to) {
        await this.mail.send({
          to,
          subject: input.emailConteudo.subject,
          text: input.emailConteudo.text,
          html: input.emailConteudo.html,
        });
      }
    }

    let pushEnviados = 0;
    if (input.push) {
      pushEnviados = await this.push.sendToUser(input.userId, input.push);
    }

    return { notificacaoId: row.id, pushEnviados };
  }

  async notifyGestores(
    tenantId: string,
    input: Omit<CriarNotificacaoInput, "userId" | "tenantId"> & {
      buildEmail?: (gestor: { email: string; displayName: string }) => {
        subject: string;
        text: string;
        html: string;
      };
    },
  ) {
    const gestores = await this.prisma.user.findMany({
      where: { tenantId, active: true, role: { in: GESTOR_ROLES } },
      select: { id: true, email: true, displayName: true, role: true },
    });

    const appUrl = this.config.get<string>("APP_PUBLIC_URL") ?? "http://localhost:3000";
    const link = input.link?.startsWith("http")
      ? input.link
      : `${appUrl}${input.link ?? "/portal"}`;

    const results = [];
    for (const g of gestores) {
      const to = resolverEmailNotificacaoUtilizador(g.role, g.email);
      const emailTpl = input.buildEmail?.(g);
      const r = await this.notifyUser({
        tenantId,
        userId: g.id,
        tipo: input.tipo,
        titulo: input.titulo,
        mensagem: input.mensagem,
        link: input.link,
        email:
          emailTpl && to
            ? { to, ...emailTpl }
            : undefined,
        push: {
          title: input.titulo,
          body: input.mensagem,
          url: link,
        },
      });
      results.push({ gestorId: g.id, ...r });
    }

    this.logger.log(
      `Notificação ${input.tipo} enviada a ${gestores.length} gestor(es) (tenant ${tenantId})`,
    );
    return { gestores: gestores.length, results };
  }

  /** Gestores + comercial (ex. falhas sync website, CRM). */
  async notifyGestoresEComercial(
    tenantId: string,
    input: Omit<CriarNotificacaoInput, "userId" | "tenantId"> & {
      buildEmail?: (dest: { email: string; displayName: string }) => {
        subject: string;
        text: string;
        html: string;
      };
    },
  ) {
    const destinatarios = await this.prisma.user.findMany({
      where: { tenantId, active: true, role: { in: GESTOR_E_COMERCIAL_ROLES } },
      select: { id: true, email: true, displayName: true, role: true },
    });

    const appUrl = this.config.get<string>("APP_PUBLIC_URL") ?? "http://localhost:3000";
    const link = input.link?.startsWith("http")
      ? input.link
      : `${appUrl}${input.link ?? "/portal"}`;

    const results = [];
    for (const d of destinatarios) {
      const to = resolverEmailNotificacaoUtilizador(d.role, d.email);
      const emailTpl = input.buildEmail?.({ email: d.email, displayName: d.displayName });
      const r = await this.notifyUser({
        tenantId,
        userId: d.id,
        tipo: input.tipo,
        titulo: input.titulo,
        mensagem: input.mensagem,
        link: input.link,
        email: emailTpl && to ? { to, ...emailTpl } : undefined,
        push: {
          title: input.titulo,
          body: input.mensagem,
          url: link,
        },
      });
      results.push({ userId: d.id, ...r });
    }

    this.logger.log(
      `Notificação ${input.tipo} enviada a ${destinatarios.length} gestor(es)/comercial (tenant ${tenantId})`,
    );
    return { destinatarios: destinatarios.length, results };
  }

  buildPedidoAnulacaoFaturaEmail(params: {
    gestorNome: string;
    comercialNome: string;
    faturaRef: string;
    motivo: string;
    portalUrl: string;
  }) {
    return EmailTemplates.pedidoAnulacaoFatura({
      gestorNome: params.gestorNome,
      comercialNome: params.comercialNome,
      faturaRef: params.faturaRef,
      motivo: params.motivo,
      portalUrl: params.portalUrl,
    });
  }

  buildPedidoAnulacaoRejeitadoEmail(params: {
    comercialNome: string;
    faturaRef: string;
    respostaMotivo: string;
    portalUrl: string;
  }) {
    return EmailTemplates.pedidoAnulacaoRejeitado(params);
  }

  buildWebsiteSyncFalhouEmail(params: {
    nomeDestinatario: string;
    entidade: string;
    evento: string;
    erro: string;
    portalUrl: string;
  }) {
    return EmailTemplates.websiteSyncFalhou(params);
  }
}
