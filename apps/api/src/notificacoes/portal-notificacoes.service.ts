import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { TenantUserRole } from "@nexiforma/database";
import { MailService } from "../mail/mail.service";
import { PrismaService } from "../prisma/prisma.service";
import { EmailTemplates } from "./templates/email.templates";
import { PushService } from "./push.service";

const GESTOR_ROLES: TenantUserRole[] = ["ADMIN", "COORDENADOR", "FINANCEIRO"];

export type CriarNotificacaoInput = {
  tenantId: string;
  userId: string;
  tipo: string;
  titulo: string;
  mensagem: string;
  link?: string;
  email?: { to: string; subject: string; text: string; html: string };
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
      select: { id: true, email: true, displayName: true },
    });

    const appUrl = this.config.get<string>("APP_PUBLIC_URL") ?? "http://localhost:3000";
    const link = input.link?.startsWith("http")
      ? input.link
      : `${appUrl}${input.link ?? "/portal"}`;

    const results = [];
    for (const g of gestores) {
      const emailTpl = input.buildEmail?.(g);
      const r = await this.notifyUser({
        tenantId,
        userId: g.id,
        tipo: input.tipo,
        titulo: input.titulo,
        mensagem: input.mensagem,
        link: input.link,
        email: emailTpl
          ? { to: g.email, ...emailTpl }
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
}
