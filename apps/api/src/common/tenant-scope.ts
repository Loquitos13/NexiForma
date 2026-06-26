import { ForbiddenException } from "@nestjs/common";
import type { RequestUser } from "../auth/types/access-token-payload";

/** Garante `tenantId` em tokens de utilizadores do tenant (`kind === "tenant"`). */
export function requireTenantId(user: RequestUser): string {
  if (user.kind !== "tenant" || !user.tenantId) {
    throw new ForbiddenException("Este recurso é só para utilizadores do tenant.");
  }
  return user.tenantId;
}
