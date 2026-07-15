import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SendEmailCommand, SendRawEmailCommand, SESClient } from "@aws-sdk/client-ses";
import * as nodemailer from "nodemailer";
import MailComposer from "nodemailer/lib/mail-composer";
import type Transporter from "nodemailer/lib/mailer";

export type MailAttachment = {
  filename: string;
  content: Buffer | string;
  contentType?: string;
};

export type SendMailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: MailAttachment[];
};

export type MailDeliveryStatus = {
  provider: "log" | "smtp" | "ses" | "brevo";
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
  private brevoApiKey: string | null = null;
  private provider: "log" | "smtp" | "ses" | "brevo" = "log";

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

    const brevoKey = this.config.get<string>("BREVO_API_KEY")?.trim();
    if (mailProvider === "brevo" || brevoKey) {
      if (brevoKey) {
        this.brevoApiKey = brevoKey;
        this.provider = "brevo";
        this.logger.log("Email via Brevo API (REST).");
        return;
      }
      this.logger.warn("MAIL_PROVIDER=brevo mas BREVO_API_KEY em falta – fallback log.");
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
    const smtpHostLower = smtpHost?.toLowerCase() ?? "";
    const sesRegion =
      this.provider === "ses" ? (this.config.get<string>("AWS_REGION") ?? "eu-west-1") : null;

    const dnsChecklist = this.buildDnsChecklist(smtpHostLower);

    const sendsRealEmail =
      this.provider === "ses" || this.provider === "smtp" || this.provider === "brevo";

    let aviso: string | null = null;
    if (!sendsRealEmail) {
      aviso =
        "Modo desenvolvimento: emails só aparecem no log do servidor. Configure MAIL_PROVIDER=brevo, smtp ou ses.";
    } else if (this.provider === "brevo") {
      aviso =
        "Brevo API activa. Verifique domínio e remetente em Senders & Domains; use BREVO_API_KEY (não SMTP).";
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
      const attachInfo =
        input.attachments?.length ?
          ` | Anexos: ${input.attachments.map((a) => a.filename).join(", ")}`
        : "";
      this.logger.log(
        `[email] To: ${input.to} | ${input.subject}${attachInfo}${replyTo ? ` | Reply-To: ${replyTo}` : ""}\n${input.text}`,
      );
      return;
    }

    if (this.provider === "ses" && this.ses) {
      if (input.attachments?.length) {
        await this.sendSesRaw(from, replyTo, input);
        return;
      }
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

    if (this.provider === "brevo" && this.brevoApiKey) {
      await this.sendViaBrevo(from, replyTo, input);
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
      attachments: this.nodemailerAttachments(input.attachments),
    });
  }

  async sendInvite(
    to: string,
    tenantName: string,
    inviteUrl: string,
    role: string,
    displayName?: string,
  ) {
    const nome = displayName?.trim() || to;
    await this.send({
      to,
      subject: `Convite NexiForma – ${tenantName}`,
      text:
        `Olá ${nome},\n\n` +
        `Foste convidado(a) para a entidade formadora «${tenantName}» no NexiForma.\n\n` +
        `Papel: ${role}\n\n` +
        `Para activar a conta e confirmar o teu email, aceita o convite em:\n${inviteUrl}\n\n` +
        `Define a palavra-passe no link - isso confirma que és o titular deste endereço de email.\n\n` +
        `O link expira em 7 dias.`,
      html:
        `<p>Olá <strong>${nome}</strong>,</p>` +
        `<p>Foste convidado(a) para <strong>${tenantName}</strong>.</p>` +
        `<p>Papel: <strong>${role}</strong></p>` +
        `<p>Clica no link abaixo para <strong>confirmar o email</strong> e definir a palavra-passe:</p>` +
        `<p><a href="${inviteUrl}">Activar conta</a></p>` +
        `<p style="color:#64748b;font-size:0.9em">O link expira em 7 dias.</p>`,
    });
  }

  async sendPasswordReset(
    to: string,
    resetUrl: string,
    expiresMinutes: number,
    options?: { mfaRequired?: boolean; mfaAppLabel?: string },
  ) {
    const appLabel = options?.mfaAppLabel ?? "a tua app autenticadora";
    const mfaNote = options?.mfaRequired
      ? `\n\nA tua conta tem verificação em dois passos. Ao abrir o link, serás pedido o código de 6 dígitos em ${appLabel}.\n`
      : "";
    const mfaHtml = options?.mfaRequired
      ? `<p style="color:#64748b;font-size:0.9em">Precisas do código de 6 dígitos em <strong>${appLabel}</strong> para concluir a redefinição.</p>`
      : "";
    await this.send({
      to,
      subject: "NexiForma – redefinir palavra-passe",
      text:
        `Recebemos um pedido para redefinir a tua palavra-passe no NexiForma.\n\n` +
        `Abre este link (válido ${expiresMinutes} minutos):\n${resetUrl}\n` +
        mfaNote +
        `\nSe não fizeste este pedido, ignora este email.`,
      html:
        `<p>Recebemos um pedido para redefinir a tua palavra-passe.</p>` +
        mfaHtml +
        `<p><a href="${resetUrl}">Redefinir palavra-passe</a></p>` +
        `<p style="color:#64748b;font-size:0.9em">O link expira em ${expiresMinutes} minutos. ` +
        `Se não fizeste este pedido, ignora este email.</p>`,
    });
  }

  private buildDnsChecklist(smtpHostLower: string): string[] {
    if (this.provider === "brevo") {
      return [
        "SPF (TXT @): v=spf1 include:spf.brevo.com ~all",
        "DKIM: registos na consola Brevo → Domains",
        "DMARC (TXT _dmarc): v=DMARC1; p=none; rua=mailto:dmarc@seu-dominio.pt",
        "Remetente MAIL_FROM verificado em Brevo → Senders",
      ];
    }
    if (this.provider === "ses") {
      return [
        "SPF (TXT @): v=spf1 include:amazonses.com ~all",
        "DKIM: 3 CNAME gerados na consola AWS SES",
        "DMARC (TXT _dmarc): v=DMARC1; p=none; rua=mailto:dmarc@seu-dominio.pt",
      ];
    }
    if (smtpHostLower.includes("brevo")) {
      return [
        "SPF (TXT @): v=spf1 include:spf.brevo.com ~all",
        "DKIM: registos mail._domainkey / brevo1._domainkey na consola Brevo",
        "DMARC (TXT _dmarc): v=DMARC1; p=none; rua=mailto:dmarc@seu-dominio.pt",
        "Guia: docs/EMAIL_SMTP_SETUP.md (secção Brevo)",
      ];
    }
    if (smtpHostLower.includes("resend")) {
      return [
        "SPF/DKIM: valores exactos na consola Resend → Domains",
        "DMARC (TXT _dmarc): v=DMARC1; p=none; rua=mailto:dmarc@seu-dominio.pt",
        "SMTP_USER=resend · SMTP_PASS=API key Resend",
        "Guia: docs/EMAIL_SMTP_SETUP.md (secção Resend)",
      ];
    }
    if (this.provider === "smtp") {
      return [
        "SPF + DKIM do teu fornecedor SMTP transacional",
        "DMARC (TXT _dmarc): v=DMARC1; p=none; rua=mailto:dmarc@seu-dominio.pt",
        "Não uses SMTP do alojamento/cPanel",
      ];
    }
    return [
      "Configure MAIL_PROVIDER=brevo + BREVO_API_KEY ou smtp (ver docs/EMAIL_SMTP_SETUP.md)",
      "DMARC (TXT _dmarc): v=DMARC1; p=none; rua=mailto:dmarc@seu-dominio.pt",
    ];
  }

  private parseFromHeader(from: string): { name: string; email: string } {
    const m = from.match(/^(.+?)\s*<([^>]+)>$/);
    if (m) return { name: m[1].trim(), email: m[2].trim() };
    return { name: "NexiForma", email: from.trim() };
  }

  private async sendViaBrevo(
    from: string,
    replyTo: string | undefined,
    input: SendMailInput,
  ): Promise<void> {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": this.brevoApiKey!,
        "Content-Type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender: this.parseFromHeader(from),
        to: [{ email: input.to }],
        ...(replyTo ? { replyTo: { email: replyTo } } : {}),
        subject: input.subject,
        textContent: input.text,
        htmlContent: input.html ?? input.text.replace(/\n/g, "<br>"),
        ...(input.attachments?.length
          ? {
              attachment: input.attachments.map((a) => ({
                name: a.filename,
                content: this.attachmentBase64(a.content),
              })),
            }
          : {}),
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      this.logger.error(`Brevo API falhou: ${res.status} ${err}`);
      throw new Error("Falha ao enviar email via Brevo API.");
    }
  }

  private attachmentBase64(content: Buffer | string): string {
    return Buffer.isBuffer(content) ? content.toString("base64") : Buffer.from(content, "utf8").toString("base64");
  }

  private nodemailerAttachments(attachments?: MailAttachment[]) {
    if (!attachments?.length) return undefined;
    return attachments.map((a) => ({
      filename: a.filename,
      content: a.content,
      contentType: a.contentType,
    }));
  }

  private async sendSesRaw(
    from: string,
    replyTo: string | undefined,
    input: SendMailInput,
  ): Promise<void> {
    if (!this.ses) return;
    const composer = new MailComposer({
      from,
      replyTo,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html ?? input.text.replace(/\n/g, "<br>"),
      attachments: this.nodemailerAttachments(input.attachments),
    });
    const message = await composer.compile().build();
    const fromEmail = from.match(/<([^>]+)>/)?.[1] ?? from;
    await this.ses.send(
      new SendRawEmailCommand({
        Source: fromEmail,
        Destinations: [input.to],
        RawMessage: { Data: message },
      }),
    );
  }
}
