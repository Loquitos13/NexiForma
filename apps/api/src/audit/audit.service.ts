import { Injectable } from "@nestjs/common";
import type { AuditActorType, Prisma } from "@nexiforma/database";
import { PrismaService } from "../prisma/prisma.service";

export type AuditEntry = {
  actorType: AuditActorType;
  actorId: string;
  actorIp?: string;
  action: string;
  resourceType: string;
  resourceId: string;
  targetTenantId?: string;
  targetUserId?: string;
  payload?: Prisma.InputJsonValue;
};

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditEntry): Promise<Record<string, unknown>> {
    return this.prisma.globalAuditLog.create({
      data: {
        actorType: entry.actorType,
        actorId: entry.actorId,
        actorIp: entry.actorIp ?? null,
        action: entry.action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        targetTenantId: entry.targetTenantId ?? null,
        targetUserId: entry.targetUserId ?? null,
        payload: entry.payload ?? undefined,
      },
    }) as Promise<Record<string, unknown>>;
  }

  list(opts: { tenantId?: string; limit?: number; cursor?: bigint }): Promise<Record<string, unknown>[]> {
    const take = Math.min(opts.limit ?? 50, 200);
    return this.prisma.globalAuditLog.findMany({
      where: opts.tenantId ? { targetTenantId: opts.tenantId } : undefined,
      orderBy: { occurredAt: "desc" },
      take,
      ...(opts.cursor ? { skip: 1, cursor: { id: opts.cursor } } : {}),
    }) as Promise<Record<string, unknown>[]>;
  }
}
