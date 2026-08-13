/** Prefixos de acções por domínio de auditoria no portal tenant. */
export const TENANT_AUDIT_SCOPES = {
  dgert: ["dgert.", "sigo."],
  faturacao: ["saft.", "faturacao.", "fatura.", "at.licenca."],
} as const;

export type TenantAuditScope = keyof typeof TENANT_AUDIT_SCOPES;

export function resolveTenantAuditPrefixes(scope: string): string[] | undefined {
  const key = scope.trim().toLowerCase() as TenantAuditScope;
  if (key in TENANT_AUDIT_SCOPES) {
    return [...TENANT_AUDIT_SCOPES[key]];
  }
  return undefined;
}
