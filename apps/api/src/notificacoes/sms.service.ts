import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export type SendSmsInput = {
  to: string;
  body: string;
};

export type SmsProvider = "log" | "twilio" | "telegram";

@Injectable()
export class SmsService implements OnModuleInit {
  private readonly logger = new Logger(SmsService.name);
  private provider: SmsProvider = "log";
  private twilioSid: string | null = null;
  private twilioToken: string | null = null;
  private twilioFrom: string | null = null;
  private telegramBotToken: string | null = null;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const provider = (this.config.get<string>("SMS_PROVIDER") ?? "log").toLowerCase();

    if (provider === "twilio") {
      this.twilioSid = this.config.get<string>("TWILIO_ACCOUNT_SID") ?? null;
      this.twilioToken = this.config.get<string>("TWILIO_AUTH_TOKEN") ?? null;
      this.twilioFrom = this.config.get<string>("TWILIO_FROM_NUMBER") ?? null;
      if (this.twilioSid && this.twilioToken && this.twilioFrom) {
        this.provider = "twilio";
        this.logger.log("SMS via Twilio.");
        return;
      }
      this.logger.warn("SMS_PROVIDER=twilio mas credenciais incompletas – fallback log.");
    }

    if (provider === "telegram") {
      this.telegramBotToken = this.config.get<string>("TELEGRAM_BOT_TOKEN") ?? null;
      if (this.telegramBotToken) {
        this.provider = "telegram";
        this.logger.log("Alertas SMS substituídos por Telegram Bot (gratuito).");
        return;
      }
      this.logger.warn("SMS_PROVIDER=telegram mas TELEGRAM_BOT_TOKEN em falta – fallback log.");
    }

    this.logger.log("SMS não configurado – mensagens registadas em log (dev).");
  }

  isEnabled(): boolean {
    return this.provider === "twilio" || this.provider === "telegram";
  }

  getProvider(): SmsProvider {
    return this.provider;
  }

  async send(input: SendSmsInput): Promise<void> {
    if (this.provider === "log") {
      this.logger.log(`[sms] To: ${input.to}\n${input.body}`);
      return;
    }

    if (this.provider === "telegram" && this.telegramBotToken) {
      const url = `https://api.telegram.org/bot${this.telegramBotToken}/sendMessage`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: input.to,
          text: input.body,
          disable_web_page_preview: true,
        }),
      });
      if (!res.ok) {
        const err = await res.text();
        this.logger.error(`Telegram falhou: ${res.status} ${err}`);
        throw new Error("Falha ao enviar mensagem Telegram.");
      }
      return;
    }

    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.twilioSid}/Messages.json`;
    const auth = Buffer.from(`${this.twilioSid}:${this.twilioToken}`).toString("base64");
    const body = new URLSearchParams({
      To: input.to,
      From: this.twilioFrom!,
      Body: input.body,
    });

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    if (!res.ok) {
      const err = await res.text();
      this.logger.error(`Twilio SMS falhou: ${res.status} ${err}`);
      throw new Error("Falha ao enviar SMS.");
    }
  }
}
