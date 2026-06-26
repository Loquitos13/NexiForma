import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";

type SnsEnvelope = {
  Type?: string;
  Message?: string;
  SubscribeURL?: string;
  TopicArn?: string;
};

type SesBouncePayload = {
  notificationType?: string;
  mail?: { messageId?: string; timestamp?: string; destination?: string[] };
  bounce?: {
    bounceType?: string;
    bounceSubType?: string;
    bouncedRecipients?: Array<{ emailAddress?: string; diagnosticCode?: string }>;
  };
  complaint?: {
    complainedRecipients?: Array<{ emailAddress?: string }>;
    complaintFeedbackType?: string;
  };
};

@Injectable()
export class MailWebhookService {
  private readonly logger = new Logger(MailWebhookService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async handleSesSns(body: SnsEnvelope) {
    const expectedTopic = this.config.get<string>("SES_SNS_TOPIC_ARN");
    if (expectedTopic && body.TopicArn && body.TopicArn !== expectedTopic) {
      this.logger.warn(`SNS TopicArn inesperado: ${body.TopicArn}`);
      return { ok: false, reason: "topic_mismatch" };
    }

    if (body.Type === "SubscriptionConfirmation" && body.SubscribeURL) {
      const res = await fetch(body.SubscribeURL);
      this.logger.log(`SNS subscrição SES confirmada (HTTP ${res.status}).`);
      return { ok: true, type: "subscription_confirmation" };
    }

    if (body.Type !== "Notification" || !body.Message) {
      return { ok: true, type: "ignored" };
    }

    let ses: SesBouncePayload;
    try {
      ses = JSON.parse(body.Message) as SesBouncePayload;
    } catch {
      this.logger.warn("Mensagem SNS SES inválida.");
      return { ok: false, reason: "invalid_message" };
    }

    const ocorridoEm = ses.mail?.timestamp ? new Date(ses.mail.timestamp) : new Date();
    const messageId = ses.mail?.messageId ?? null;

    if (ses.notificationType === "Bounce" && ses.bounce) {
      for (const r of ses.bounce.bouncedRecipients ?? []) {
        const email = r.emailAddress?.trim();
        if (!email) continue;
        await this.prisma.emailEntregaEvento.create({
          data: {
            tipo: "BOUNCE",
            destinatario: email,
            motivo: [ses.bounce.bounceType, ses.bounce.bounceSubType, r.diagnosticCode]
              .filter(Boolean)
              .join(" · "),
            messageId,
            ocorridoEm,
            detalhe: ses as object,
          },
        });
        this.logger.warn(`Bounce SES: ${email} (${ses.bounce.bounceType})`);
      }
      return { ok: true, type: "bounce" };
    }

    if (ses.notificationType === "Complaint" && ses.complaint) {
      for (const r of ses.complaint.complainedRecipients ?? []) {
        const email = r.emailAddress?.trim();
        if (!email) continue;
        await this.prisma.emailEntregaEvento.create({
          data: {
            tipo: "COMPLAINT",
            destinatario: email,
            motivo: ses.complaint.complaintFeedbackType ?? "complaint",
            messageId,
            ocorridoEm,
            detalhe: ses as object,
          },
        });
        this.logger.warn(`Complaint SES: ${email}`);
      }
      return { ok: true, type: "complaint" };
    }

    if (ses.notificationType === "Delivery") {
      for (const email of ses.mail?.destination ?? []) {
        await this.prisma.emailEntregaEvento.create({
          data: {
            tipo: "DELIVERY",
            destinatario: email,
            messageId,
            ocorridoEm,
            detalhe: ses as object,
          },
        });
      }
      return { ok: true, type: "delivery" };
    }

    return { ok: true, type: "ignored" };
  }

  listRecentEventos(limit = 30): Promise<unknown> {
    return this.prisma.emailEntregaEvento.findMany({
      orderBy: { ocorridoEm: "desc" },
      take: limit,
    });
  }

  async deliveryStats() {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [bounces, complaints, deliveries] = await Promise.all([
      this.prisma.emailEntregaEvento.count({
        where: { tipo: "BOUNCE", ocorridoEm: { gte: since } },
      }),
      this.prisma.emailEntregaEvento.count({
        where: { tipo: "COMPLAINT", ocorridoEm: { gte: since } },
      }),
      this.prisma.emailEntregaEvento.count({
        where: { tipo: "DELIVERY", ocorridoEm: { gte: since } },
      }),
    ]);
    return { bounces30d: bounces, complaints30d: complaints, deliveries30d: deliveries, since };
  }
}
