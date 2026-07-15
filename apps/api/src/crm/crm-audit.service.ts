import { Injectable } from "@nestjs/common";
import type { Prisma } from "@nexiforma/database";
import { AuditService } from "../audit/audit.service";
import type { RequestUser } from "../auth/types/access-token-payload";

export type CrmAuditParams = {
  user?: RequestUser | null;
  tenantId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  payload?: Record<string, unknown>;
};

@Injectable()
export class CrmAuditService {
  constructor(private readonly audit: AuditService) {}

  async log(params: CrmAuditParams): Promise<void> {
    await this.audit.log({
      actorType: params.user?.sub ? "TENANT_USER" : "SYSTEM",
      actorId: params.user?.sub ?? "system",
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      targetTenantId: params.tenantId,
      targetUserId: params.user?.sub,
      payload: params.payload as Prisma.InputJsonValue | undefined,
    });
  }

  list(tenantId: string, limit = 50, cursor?: bigint) {
    return this.audit.list({ tenantId, limit, cursor });
  }
}
