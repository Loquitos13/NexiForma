import { Injectable } from "@nestjs/common";
import type { AuditActorType, Prisma } from "@nexiforma/database";
import { AuditService } from "../audit/audit.service";
import type { RequestUser } from "../auth/types/access-token-payload";

export type CrmAuditParams = {
  user?: RequestUser | null;
  tenantId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  payload?: Record<string, unknown>;
  /** Override (ex.: PUBLIC_LINK em resposta pública). */
  actorType?: AuditActorType;
  actorId?: string;
  actorIp?: string;
};

@Injectable()
export class CrmAuditService {
  constructor(private readonly audit: AuditService) {}

  async log(params: CrmAuditParams): Promise<void> {
    const actorType =
      params.actorType ?? (params.user?.sub ? "TENANT_USER" : "SYSTEM");
    const actorId =
      params.actorId ??
      params.user?.sub ??
      (actorType === "PUBLIC_LINK" ? "public-link" : "system");
    await this.audit.log({
      actorType,
      actorId,
      actorIp: params.actorIp,
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      targetTenantId: params.tenantId,
      targetUserId: params.user?.sub,
      payload: params.payload as Prisma.InputJsonValue | undefined,
    });
  }

  list(
    tenantId: string,
    limit = 50,
    cursor?: bigint,
    opts?: { action?: string; actorType?: AuditActorType; since?: Date; q?: string },
  ) {
    return this.audit.list({
      tenantId,
      limit,
      cursor,
      action: opts?.action,
      actorType: opts?.actorType,
      since: opts?.since,
      q: opts?.q,
    });
  }
}
