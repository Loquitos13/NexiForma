import { Injectable, Logger } from "@nestjs/common";
import { AuditService } from "../audit/audit.service";

/** Identificadores dos serviços externos monitorizados pela plataforma. */
export type ExternalServiceId = "brevo" | "persona" | "teams" | "at" | "sigo" | "nif_pt";

export type ExternalServiceErrorInput = {
  service: ExternalServiceId;
  message: string;
  tenantId?: string;
  code?: string;
  detail?: string;
};

/**
 * Regista falhas de integrações externas em `global_audit_logs`
 * (action `external.error.{service}`) para o painel de super admin.
 */
@Injectable()
export class ExternalServiceEventService {
  private readonly logger = new Logger(ExternalServiceEventService.name);

  constructor(private readonly audit: AuditService) {}

  recordError(input: ExternalServiceErrorInput): void {
    const message = input.message.trim().slice(0, 500);
    if (!message) return;

    void this.audit
      .log({
        actorType: "SYSTEM",
        actorId: "external-service-monitor",
        action: `external.error.${input.service}`,
        resourceType: "ExternalService",
        resourceId: input.service,
        targetTenantId: input.tenantId,
        payload: {
          message,
          ...(input.code ? { code: input.code.slice(0, 120) } : {}),
          ...(input.detail ? { detail: input.detail.slice(0, 1000) } : {}),
        },
      })
      .catch((err) => {
        this.logger.warn(
          `Falha ao registar external.error.${input.service}: ${err instanceof Error ? err.message : String(err)}`,
        );
      });
  }
}
