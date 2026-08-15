import { Injectable, Logger } from "@nestjs/common";
import { AuditService } from "../audit/audit.service";

/** Identificadores dos serviços externos monitorizados pela plataforma. */
export type ExternalServiceId = "brevo" | "persona" | "teams" | "at" | "sigo" | "nif_pt";

export type ExternalServiceEventOutcome = "success" | "error";

export type ExternalServiceEventInput = {
  service: ExternalServiceId;
  outcome: ExternalServiceEventOutcome;
  message: string;
  tenantId?: string;
  code?: string;
  detail?: string;
  /** Destinatário (ex.: email Brevo). */
  email?: string;
  /** NIF validado (ex.: NIF.PT). */
  nif?: string;
  /** Referência externa (inquiry Persona, fatura, submissão SIGO, etc.). */
  resourceRef?: string;
};

export type ExternalServiceErrorInput = Omit<ExternalServiceEventInput, "outcome">;

export type ExternalServiceSuccessInput = Omit<ExternalServiceEventInput, "outcome">;

/**
 * Regista eventos de integrações externas em `global_audit_logs`
 * (`external.success.{service}` / `external.error.{service}`) para auditoria filtrada por serviço.
 */
@Injectable()
export class ExternalServiceEventService {
  private readonly logger = new Logger(ExternalServiceEventService.name);

  constructor(private readonly audit: AuditService) {}

  recordEvent(input: ExternalServiceEventInput): void {
    const message = input.message.trim().slice(0, 500);
    if (!message) return;

    void this.audit
      .log({
        actorType: "SYSTEM",
        actorId: "external-service-monitor",
        action: `external.${input.outcome}.${input.service}`,
        resourceType: "ExternalService",
        resourceId: input.service,
        targetTenantId: input.tenantId,
        payload: {
          message,
          outcome: input.outcome,
          ...(input.code ? { code: input.code.slice(0, 120) } : {}),
          ...(input.detail ? { detail: input.detail.slice(0, 1000) } : {}),
          ...(input.email ? { email: input.email.trim().slice(0, 320) } : {}),
          ...(input.nif ? { nif: input.nif.replace(/\D/g, "").slice(0, 20) } : {}),
          ...(input.resourceRef ? { resourceRef: input.resourceRef.slice(0, 120) } : {}),
        },
      })
      .catch((err) => {
        this.logger.warn(
          `Falha ao registar external.${input.outcome}.${input.service}: ${err instanceof Error ? err.message : String(err)}`,
        );
      });
  }

  recordError(input: ExternalServiceErrorInput): void {
    this.recordEvent({ ...input, outcome: "error" });
  }

  recordSuccess(input: ExternalServiceSuccessInput): void {
    this.recordEvent({ ...input, outcome: "success" });
  }
}
