import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export type SendSmsInput = {
  to: string;
  body: string;
};

@Injectable()
export class SmsService implements OnModuleInit {
  private readonly logger = new Logger(SmsService.name);
  private provider: "log" | "twilio" = "log";
  private twilioSid: string | null = null;
  private twilioToken: string | null = null;
  private twilioFrom: string | null = null;

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
    this.logger.log("SMS não configurado – mensagens registadas em log (dev).");
  }

  isEnabled(): boolean {
    return this.provider === "twilio";
  }

  getProvider(): "log" | "twilio" {
    return this.provider;
  }

  async send(input: SendSmsInput): Promise<void> {
    if (this.provider === "log") {
      this.logger.log(`[sms] To: ${input.to}\n${input.body}`);
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
