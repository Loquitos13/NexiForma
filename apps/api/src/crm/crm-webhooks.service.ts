import { Injectable, Logger } from "@nestjs/common";
import { createHmac } from "crypto";
import type { CrmWebhookEvent } from "@nexiforma/shared";
import { CrmConfigService } from "./crm-config.service";
import { safeFetch } from "../common/safe-fetch.util";

@Injectable()
export class CrmWebhooksService {
  private readonly logger = new Logger(CrmWebhooksService.name);

  constructor(private readonly config: CrmConfigService) {}

  async emit(tenantId: string, event: CrmWebhookEvent, data: Record<string, unknown>): Promise<void> {
    const cfg = await this.config.getByTenantId(tenantId);
    const hooks = cfg.outboundWebhooks.filter((h) => h.active && h.events.includes(event));
    if (!hooks.length) return;

    const payload = { event, occurredAt: new Date().toISOString(), data };
    const body = JSON.stringify(payload);

    await Promise.allSettled(
      hooks.map(async (hook) => {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          "User-Agent": "NexiForma-CRM-Webhook/1.0",
          "X-NexiForma-Event": event,
        };
        if (hook.secret?.trim()) {
          const sig = createHmac("sha256", hook.secret.trim()).update(body).digest("hex");
          headers["X-NexiForma-Signature"] = `sha256=${sig}`;
        }
        try {
          const res = await safeFetch(hook.url, {
            method: "POST",
            headers,
            body,
            signal: AbortSignal.timeout(15_000),
            requireHttps: process.env.NODE_ENV === "production",
            allowHttp: process.env.NODE_ENV !== "production",
          });
          if (!res.ok) {
            this.logger.warn(`Webhook respondeu ${res.status} para ${event}`);
          }
        } catch (err) {
          this.logger.warn(
            `Webhook falhou para ${event}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }),
    );
  }
}
