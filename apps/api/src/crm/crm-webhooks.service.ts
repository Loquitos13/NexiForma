import { Injectable, Logger } from "@nestjs/common";
import { createHmac } from "crypto";
import type { CrmWebhookEvent } from "@nexiforma/shared";
import { CrmConfigService } from "./crm-config.service";

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
        const res = await fetch(hook.url, {
          method: "POST",
          headers,
          body,
          signal: AbortSignal.timeout(15_000),
        });
        if (!res.ok) {
          this.logger.warn(`Webhook ${hook.url} respondeu ${res.status} para ${event}`);
        }
      }),
    );
  }
}
