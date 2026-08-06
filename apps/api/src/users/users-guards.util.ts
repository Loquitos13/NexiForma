import type { TenantUserRole } from "@nexiforma/database";

/** Papéis Prisma que mapeiam para `tenant_manager` no JWT (apenas ADMIN). */
export const TENANT_MANAGER_PRISMA_ROLES = new Set<TenantUserRole>(["ADMIN"]);

/** Gestor + coordenador pedagógico (formação). */
export const FORMACAO_MANAGER_PRISMA_ROLES = new Set<TenantUserRole>([
  "ADMIN",
  "COORDENADOR_PEDAGOGICO",
  "COORDENADOR", // legado
]);

export function isTenantManagerPrismaRole(role: TenantUserRole): boolean {
  return TENANT_MANAGER_PRISMA_ROLES.has(role);
}

export function userSelectPublic() {
  return {
    id: true,
    email: true,
    displayName: true,
    role: true,
    active: true,
    mfaEnabled: true,
    mfaRequired: true,
    mfaApp: true,
    mfaSecret: true,
    emailVerifiedAt: true,
    createdAt: true,
    updatedAt: true,
  } as const;
}

export function mapUserPublic<T extends { mfaSecret?: string | null; mfaEnabled: boolean }>(
  row: T,
): Omit<T, "mfaSecret"> & { mfaSetupPending: boolean } {
  const { mfaSecret, ...rest } = row;
  return {
    ...rest,
    mfaSetupPending: Boolean(mfaSecret && !rest.mfaEnabled),
  };
}
