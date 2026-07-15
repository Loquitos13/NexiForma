import type { Prisma, SubscriptionStatus } from "@nexiforma/database";
import type { PrismaService } from "../prisma/prisma.service";

const PREFERRED_STATUSES: SubscriptionStatus[] = ["TRIALING", "ACTIVE", "PAST_DUE"];

const subscriptionInclude = { plan: true } as const;

export type TenantSubscriptionWithPlan = Prisma.TenantSubscriptionGetPayload<{
  include: typeof subscriptionInclude;
}>;

/** Subscrição efectiva do tenant: activa/trial preferida, depois a mais recentemente actualizada. */
export async function findCurrentTenantSubscription(
  prisma: PrismaService,
  tenantId: string,
): Promise<TenantSubscriptionWithPlan | null> {
  const orderBy: Prisma.TenantSubscriptionOrderByWithRelationInput[] = [
    { updatedAt: "desc" },
    { createdAt: "desc" },
  ];

  const preferred = await prisma.tenantSubscription.findFirst({
    where: { tenantId, status: { in: PREFERRED_STATUSES } },
    orderBy,
    include: subscriptionInclude,
  });
  if (preferred) return preferred;

  return prisma.tenantSubscription.findFirst({
    where: { tenantId },
    orderBy,
    include: subscriptionInclude,
  });
}
