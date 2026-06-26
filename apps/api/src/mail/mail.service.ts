import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SendEmailCommand, SESClient } from "@aws-sdk/client-ses";
import * as nodemailer from "nodemailer";
import type Transporter from "nodemailer/lib/mailer";

export type SendMailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export type MailDeliveryStatus = {
  provider: "log" | "smtp" | "ses";
  /** true = mensagens saem para a internet; false = só log local */
  sendsRealEmail: boolean;
  mode: "production" | "development";
  from: string;
  replyTo: string | null;
  sesRegion: string | null;
  smtpHost: string | null;
  aviso: string | null;
  dnsChecklist: string[];
};

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;
  private ses: SESClient | null = null;
  private provider: "log" | "smtp" | "ses" = "log";

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const mailProvider = (this.config.get<string>("MAIL_PROVIDER") ?? "").toLowerCase();
    if (mailProvider === "ses") {
      const region = this.config.get<string>("AWS_REGION") ?? "eu-west-1";
      this.ses = new SESClient({ region });
      this.provider = "ses";
      this.logger.log("Email via AWS SES.");
      return;
    }

    const host = this.config.get<string>("SMTP_HOST");
    if (!host) {
      this.logger.log("SMTP não configurado – emails serão registados em log (dev).");
      return;
    }
    this.provider = "smtp";
    this.transporter = nodemailer.createTransport({
      host,
      port: Number(this.config.get<string>("SMTP_PORT") ?? 587),
      secure: this.config.get<string>("SMTP_SECURE") === "true",
      auth: {
        user: this.config.get<string>("SMTP_USER"),
        pass: this.config.get<string>("SMTP_PASS"),
      },
    });
    this.logger.log(`Email via SMTP (${host}).`);
  }

  getDeliveryStatus(): MailDeliveryStatus {
    const from =
      this.config.get<string>("MAIL_FROM") ?? "NexiForma <noreply@nexiforma.local>";
    const replyTo = this.config.get<string>("MAIL_REPLY_TO")?.trim() || null;
    const smtpHost = this.config.get<string>("SMTP_HOST") ?? null;
    const sesRegion =
      this.provider === "ses" ? (this.config.get<string>("AWS_REGION") ?? "eu-west-1") : null;

    const sendsRealEmail = this.provider === "ses" || this.provider === "smtp";
    const dnsChecklist = [
      "SPF: v=spf1 include:amazonses.com ~all (se MAIL_PROVIDER=ses)",
      "DKIM: 3 CNAME gerados na consola AWS SES",
      "DMARC: v=DMARC1; p=quarantine; rua=mailto:dmarc@seu-dominio.pt",
      "Não usar SMTP do alojamento/cPanel para a aplicação",
    ];

    let aviso: string | null = null;
    if (!sendsRealEmail) {
      aviso =
        "Modo desenvolvimento: emails só aparecem no log do servidor. Configure MAIL_PROVIDER=ses em produção.";
    } else if (this.provider === "smtp" && smtpHost) {
      aviso =
        "SMTP configurado. Confirme SPF/DKIM/DMARC do domínio; evite SMTP partilhado do hosting.";
    } else if (this.provider === "ses") {
      aviso =
        "AWS SES activo. Verifique domínio, saída do sandbox e webhook SNS para bounces.";
    }

    return {
      provider: this.provider,
      sendsRealEmail,
      mode: sendsRealEmail ? "production" : "development",
      from,
      replyTo,
      sesRegion,
      smtpHost,
      aviso,
      dnsChecklist,
    };
  }

  async send(input: SendMailInput): Promise<void> {
    const from =
      this.config.get<string>("MAIL_FROM") ?? "NexiForma <noreply@nexiforma.local>";
    const replyTo = this.config.get<string>("MAIL_REPLY_TO")?.trim() || undefined;

    if (this.provider === "log") {
      this.logger.log(
        `[email] To: ${input.to} | ${input.subject}${replyTo ? ` | Reply-To: ${replyTo}` : ""}\n${input.text}`,
      );
      return;
    }

    if (this.provider === "ses" && this.ses) {
      const fromEmail = from.match(/<([^>]+)>/)?.[1] ?? from;
      await this.ses.send(
        new SendEmailCommand({
          Source: fromEmail,
          Destination: { ToAddresses: [input.to] },
          ReplyToAddresses: replyTo ? [replyTo] : undefined,
          Message: {
            Subject: { Data: input.subject, Charset: "UTF-8" },
            Body: {
              Text: { Data: input.text, Charset: "UTF-8" },
              Html: {
                Data: input.html ?? input.text.replace(/\n/g, "<br>"),
                Charset: "UTF-8",
              },
            },
          },
        }),
      );
      return;
    }

    if (!this.transporter) {
      this.logger.log(`[email] To: ${input.to} | ${input.subject}\n${input.text}`);
      return;
    }

    await this.transporter.sendMail({
      from,
      replyTo,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html ?? input.text.replace(/\n/g, "<br>"),
    });
  }

  async sendInvite(to: string, tenantName: string, inviteUrl: string, role: string) {
    await this.send({
      to,
      subject: `Convite NexiForma – ${tenantName}`,
      text:
        `Foste convidado(a) para a entidade formadora «${tenantName}» no NexiForma.\n\n` +
        `Papel: ${role}\n` +
        `Aceita o convite em: ${inviteUrl}\n\n` +
        `O link expira em 7 dias.`,
      html:
        `<p>Foste convidado(a) para <strong>${tenantName}</strong>.</p>` +
        `<p>Papel: <strong>${role}</strong></p>` +
        `<p><a href="${inviteUrl}">Aceitar convite</a></p>`,
    });
  }
}
