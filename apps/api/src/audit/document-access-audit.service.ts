import { Injectable, Logger } from "@nestjs/common";
import type { Prisma } from "@nexiforma/database";
import type { RequestUser } from "../auth/types/access-token-payload";
import { AuditService } from "./audit.service";

export type DocumentAccessChannel = "presigned" | "stream" | "generated";

export type DocumentAccessAuditParams = {
  user: RequestUser;
  tenantId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  channel: DocumentAccessChannel;
  payload?: Record<string, unknown>;
};

/**
 * Auditoria de acesso a ficheiros/documentos sensíveis (RGPD / compliance).
 * Falhas de persistência não bloqueiam o download.
 */
@Injectable()
export class DocumentAccessAuditService {
  private readonly logger = new Logger(DocumentAccessAuditService.name);

  constructor(private readonly audit: AuditService) {}

  async logDownload(params: DocumentAccessAuditParams): Promise<void> {
    try {
      await this.audit.log({
        actorType: "TENANT_USER",
        actorId: params.user.sub,
        action: params.action,
        resourceType: params.resourceType,
        resourceId: params.resourceId,
        targetTenantId: params.tenantId,
        targetUserId: params.user.sub,
        payload: {
          channel: params.channel,
          role: params.user.role,
          ...(params.payload ?? {}),
        } as Prisma.InputJsonValue,
      });
    } catch (err) {
      this.logger.warn(
        `Falha ao auditar download ${params.action}/${params.resourceId}: ${String(err)}`,
      );
    }
  }
}
