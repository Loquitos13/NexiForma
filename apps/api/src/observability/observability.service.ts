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
      awsRegion: this.config.get<string>("AWS_REGION") ?? null,
      xrayEnabled: this.config.get<string>("AWS_XRAY_ENABLED") === "true",
    };
  }

  exportAuditForCloudWatch(opts: {
    tenantId?: string;
    limit?: number;
    since?: string;
    action?: string;
    actorType?: string;
    q?: string;
  }) {
    const since = opts.since ? new Date(opts.since) : undefined;
    const actorTypeRaw = opts.actorType?.trim().toUpperCase();
    const allowed = new Set(["SUPERADMIN_USER", "SYSTEM", "TENANT_USER", "PUBLIC_LINK"]);
    const actorType =
      actorTypeRaw && allowed.has(actorTypeRaw)
        ? (actorTypeRaw as "SUPERADMIN_USER" | "SYSTEM" | "TENANT_USER" | "PUBLIC_LINK")
        : undefined;
    return this.audit
      .list({
        tenantId: opts.tenantId,
        limit: opts.limit ?? 100,
        since: since && !Number.isNaN(since.getTime()) ? since : undefined,
        action: opts.action?.trim() || undefined,
        actorType,
        q: opts.q?.trim() || undefined,
      })
      .then((rows) =>
        rows.map((row) => ({
          type: "audit_event",
          timestamp: row["occurredAt"] ?? new Date().toISOString(),
          actorType: row["actorType"],
          actorId: row["actorId"],
          actorIp: row["actorIp"] ?? null,
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