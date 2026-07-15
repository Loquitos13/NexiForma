import { Injectable, Logger } from "@nestjs/common";
import { MailService } from "../mail/mail.service";
import { PrismaService } from "../prisma/prisma.service";
import { EmailTemplates } from "./templates/email.templates";
import {
  alertFingerprint,
  buildErroServidorDetalhe,
  buildErroServidorHtml,
  severityFromStatusCode,
  shouldDedupAlert,
  type ErroServidorContext,
} from "./platform-alertas.util";

export type ErroPlataformaContext = {
  tenantId?: string;
  tenantNome?: string;
  modulo: string;
  resumo: string;
  detalhe?: string;
};

/**
 * Alertas por email à equipa NexiForma (platform_users) quando ocorre erro em qualquer tenant.
 */
@Injectable()
export class PlatformAlertasService {
  private readonly logger = new Logger(PlatformAlertasService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  private alertsEnabled(): boolean {
    return process.env.PLATFORM_ERROR_ALERTS_ENABLED !== "false";
  }

  /** Erro interno / módulo (ex. webhook sync). */
  async notificarErro(input: ErroPlataformaContext) {
    return this.notificarErroServidor(input);
  }

  /** Erro HTTP 4xx/5xx ou excepção não tratada - mensagem exacta + contexto. */
  async notificarErroServidor(input: ErroServidorContext) {
    if (!this.alertsEnabled()) {
      return { enviados: 0, disabled: true };
    }

    const fingerprint = alertFingerprint(input);
    if (shouldDedupAlert(fingerprint)) {
      return { enviados: 0, deduped: true };
    }

    let tenantNome = input.tenantNome;
    if (!tenantNome && input.tenantId) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: input.tenantId },
        select: { legalName: true, slug: true },
      });
      tenantNome = tenant?.legalName ?? tenant?.slug ?? input.tenantId;
    }

    const ctx: ErroServidorContext = { ...input, tenantNome };
    const detalheTexto = buildErroServidorDetalhe(ctx);
    const detalheHtml = buildErroServidorHtml(ctx);

    try {
      await this.prisma.platformHttpAlert.create({
        data: {
          statusCode: input.statusCode ?? 500,
          httpMethod: input.httpMethod,
          httpPath: input.httpPath,
          modulo: input.modulo,
          resumo: input.resumo.slice(0, 4000),
          corpo: input.responseBody?.slice(0, 8000),
          stack: input.stack?.slice(0, 8000) ?? input.detalhe?.slice(0, 8000),
          tenantId: input.tenantId,
          tenantSlug: input.tenantSlug,
          userEmail: input.userEmail,
          userId: input.userId,
          severity: severityFromStatusCode(input.statusCode),
          fingerprint,
        },
      });
    } catch (err) {
      this.logger.warn(`Falha ao persistir alerta HTTP: ${String(err)}`);
    }

    const admins = await this.prisma.platformUser.findMany({
      where: { active: true },
      select: { email: true, displayName: true },
    });

    if (!admins.length) {
      this.logger.warn(`Erro plataforma sem destinatários: ${input.resumo}`);
      return { enviados: 0 };
    }

    const subjectSuffix = input.httpPath
      ? `${input.httpMethod ?? "HTTP"} ${input.httpPath} → ${input.statusCode ?? 500}`
      : input.modulo;

    const tpl = EmailTemplates.erroPlataforma({
      modulo: input.modulo,
      tenantLabel: tenantNome ?? input.tenantSlug ?? input.tenantId ?? "-",
      resumo: input.resumo,
      detalhe: detalheTexto,
      htmlDetalhe: detalheHtml,
      statusCode: input.statusCode,
    });

    const delivery = this.mail.getDeliveryStatus();
    let enviados = 0;
    let falhas = 0;

    for (const admin of admins) {
      try {
        await this.mail.send({
          to: admin.email,
          subject: `[NexiForma HTTP ${input.statusCode ?? 500}] ${subjectSuffix}`.slice(0, 180),
          text: tpl.text,
          html: tpl.html,
        });
        enviados++;
      } catch (err) {
        falhas++;
        this.logger.error(
          `Falha ao enviar alerta de erro a ${admin.email}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    const destinatarios = admins.map((a) => a.email).join(", ");
    if (delivery.sendsRealEmail) {
      this.logger.warn(
        `Erro servidor: email enviado a ${enviados}/${admins.length} superadmin(s) (${destinatarios}): ${input.resumo}`,
      );
    } else {
      this.logger.warn(
        `Erro servidor: alerta só em LOG (sem SMTP/Brevo/SES). Destinatário(s): ${destinatarios}. ` +
          `Configure MAIL_PROVIDER + credenciais para receber email. Resumo: ${input.resumo}`,
      );
    }

    return { enviados, falhas, logOnly: !delivery.sendsRealEmail };
  }
}
