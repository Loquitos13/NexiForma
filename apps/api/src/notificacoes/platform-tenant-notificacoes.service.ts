import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { MailService } from "../mail/mail.service";
import { PrismaService } from "../prisma/prisma.service";
import { EmailTemplates } from "./templates/email.templates";

export type TenantLifecycleAcao = "criado" | "actualizado" | "arquivado" | "eliminado";

export type TenantLifecycleInput = {
  acao: TenantLifecycleAcao;
  tenant: {
    id: string;
    slug: string;
    legalName: string;
    nif: string;
    status: string;
  };
  actorEmail: string;
  detalhe?: string;
};

@Injectable()
export class PlatformTenantNotificacoesService {
  private readonly logger = new Logger(PlatformTenantNotificacoesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  async notificarSuperadminsTenantLifecycle(input: TenantLifecycleInput) {
    const admins = await this.prisma.platformUser.findMany({
      where: { active: true },
      select: { email: true },
    });

    if (!admins.length) {
      this.logger.warn(`Tenant ${input.acao}: sem platform_users activos para email.`);
      return { enviados: 0 };
    }

    const appUrl = this.config.get<string>("APP_PUBLIC_URL") ?? "http://localhost:3000";
    const plataformaUrl = `${appUrl.replace(/\/$/, "")}/plataforma/tenantes/${input.tenant.id}`;
    const tpl = EmailTemplates.tenantLifecycleSuperadmin({
      acao: input.acao,
      legalName: input.tenant.legalName,
      slug: input.tenant.slug,
      nif: input.tenant.nif,
      status: input.tenant.status,
      actorEmail: input.actorEmail,
      detalhe: input.detalhe,
      plataformaUrl,
    });

    for (const admin of admins) {
      await this.mail.send({
        to: admin.email,
        subject: tpl.subject,
        text: tpl.text,
        html: tpl.html,
      });
    }

    this.logger.log(
      `Tenant ${input.acao} (${input.tenant.slug}): email a ${admins.length} superadmin(s).`,
    );
    return { enviados: admins.length };
  }

  async enviarBoasVindasGestor(input: {
    email: string;
    displayName: string;
    entidadeFormadora: string;
    slug: string;
  }) {
    const appUrl = this.config.get<string>("APP_PUBLIC_URL") ?? "http://localhost:3000";
    const base = appUrl.replace(/\/$/, "");
    const loginUrl = `${base}/login?slug=${encodeURIComponent(input.slug)}`;
    const recuperarUrl = `${base}/login/recuperar?slug=${encodeURIComponent(input.slug)}`;

    const tpl = EmailTemplates.tenantGestorBemVindo({
      nomeGestor: input.displayName,
      entidadeFormadora: input.entidadeFormadora,
      slug: input.slug,
      loginUrl,
      recuperarUrl,
    });

    await this.mail.send({
      to: input.email,
      subject: tpl.subject,
      text: tpl.text,
      html: tpl.html,
    });

    this.logger.log(`Boas-vindas gestor enviado: ${input.email} (${input.slug})`);
    return { ok: true };
  }

  async enviarConviteGestor(input: {
    email: string;
    displayName: string;
    entidadeFormadora: string;
    slug: string;
    inviteUrl: string;
  }) {
    const appUrl = this.config.get<string>("APP_PUBLIC_URL") ?? "http://localhost:3000";
    const base = appUrl.replace(/\/$/, "");
    const loginUrl = `${base}/login?slug=${encodeURIComponent(input.slug)}`;

    const tpl = EmailTemplates.tenantGestorConvite({
      nomeGestor: input.displayName,
      entidadeFormadora: input.entidadeFormadora,
      slug: input.slug,
      inviteUrl: input.inviteUrl,
      loginUrl,
    });

    await this.mail.send({
      to: input.email,
      subject: tpl.subject,
      text: tpl.text,
      html: tpl.html,
    });

    this.logger.log(`Convite gestor enviado: ${input.email} (${input.slug})`);
    return { ok: true };
  }
}
