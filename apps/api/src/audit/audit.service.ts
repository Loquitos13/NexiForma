import { Injectable } from "@nestjs/common";
import type { AuditActorType, GlobalAuditLog, Prisma } from "@nexiforma/database";
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

export type AuditListOpts = {
  tenantId?: string;
  limit?: number;
  cursor?: bigint;
  action?: string;
  actorType?: AuditActorType;
  since?: Date;
  until?: Date;
  /** Pesquisa livre em action / resourceType / resourceId / actorId */
  q?: string;
};

function serializeAuditRow(row: GlobalAuditLog): Record<string, unknown> {
  return {
    id: row.id.toString(),
    occurredAt: row.occurredAt,
    actorType: row.actorType,
    actorId: row.actorId,
    actorIp: row.actorIp != null ? String(row.actorIp) : null,
    action: row.action,
    resourceType: row.resourceType,
    resourceId: row.resourceId,
    targetTenantId: row.targetTenantId,
    targetUserId: row.targetUserId,
    payload: row.payload ?? undefined,
  };
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditEntry): Promise<Record<string, unknown>> {
    const row = await this.prisma.globalAuditLog.create({
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
    });
    return serializeAuditRow(row);
  }

  async list(opts: AuditListOpts): Promise<Record<string, unknown>[]> {
    const take = Math.min(opts.limit ?? 50, 200);
    const q = opts.q?.trim();
    const where: Prisma.GlobalAuditLogWhereInput = {
      ...(opts.tenantId ? { targetTenantId: opts.tenantId } : {}),
      ...(opts.action
        ? { action: { contains: opts.action, mode: "insensitive" } }
        : {}),
      ...(opts.actorType ? { actorType: opts.actorType } : {}),
      ...((opts.since || opts.until)
        ? {
            occurredAt: {
              ...(opts.since ? { gte: opts.since } : {}),
              ...(opts.until ? { lte: opts.until } : {}),
            },
          }
        : {}),
      ...(q
        ? {
            OR: [
              { action: { contains: q, mode: "insensitive" } },
              { resourceType: { contains: q, mode: "insensitive" } },
              { resourceId: { contains: q, mode: "insensitive" } },
              { actorId: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const rows = await this.prisma.globalAuditLog.findMany({
      where,
      orderBy: { occurredAt: "desc" },
      take,
      ...(opts.cursor ? { skip: 1, cursor: { id: opts.cursor } } : {}),
    });
    return rows.map(serializeAuditRow);
  }
}
