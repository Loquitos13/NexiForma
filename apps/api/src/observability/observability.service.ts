import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuditService } from "../audit/audit.service";
import { AssiduidadeQueueService } from "../queue/assiduidade-queue.service";

@Injectable()
export class ObservabilityService {
  constructor(
    private readonly audit: AuditService,
    private readonly config: ConfigService,
    private readonly queue: AssiduidadeQueueService,
  ) {}

  platformStatus() {
    return {
      observabilityEnabled: this.config.get<string>("OBSERVABILITY_ENABLED") !== "false",
      queueBackend: this.queue.getBackend(),
      atFaturasMode: this.config.get<string>("AT_FATURAS_MODE") ?? "disabled",
      sigoMode: this.config.get<string>("SIGO_API_MODE") ?? "disabled",
      cmdSignatureMode: this.config.get<string>("CMD_SIGNATURE_MODE") ?? "disabled",
      awsRegion: this.config.get<string>("AWS_REGION") ?? null,
      xrayEnabled: this.config.get<string>("AWS_XRAY_ENABLED") === "true",
    };
  }

  /** Formato compatível com CloudWatch Logs Insights (array de eventos). */
  exportAuditForCloudWatch(opts: { tenantId?: string; limit?: number; since?: string }) {
    const since = opts.since ? new Date(opts.since) : undefined;
    return this.audit.list({
      tenantId: opts.tenantId,
      limit: opts.limit ?? 100,
    }).then((rows) =>
      rows
        .filter((row) => {
          if (!since) return true;
          const occurred = row["occurredAt"];
          if (!occurred) return true;
          return new Date(String(occurred)) >= since;
        })
        .map((row) => ({
          type: "audit_event",
          timestamp: row["occurredAt"] ?? new Date().toISOString(),
          actorType: row["actorType"],
          actorId: row["actorId"],
          action: row["action"],
          resourceType: row["resourceType"],
          resourceId: row["resourceId"],
          targetTenantId: row["targetTenantId"] ?? null,
          targetUserId: row["targetUserId"] ?? null,
          payload: row["payload"] ?? null,
        })),
    );
  }
}
