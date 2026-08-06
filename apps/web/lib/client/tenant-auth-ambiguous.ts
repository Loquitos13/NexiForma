import type { TenantAuthPickOption } from "@/components/auth/tenant-auth-pick";

const TENANT_AMBIGUOUS_CODE = "TENANT_AMBIGUOUS";

function isTenantPickList(value: unknown): value is TenantAuthPickOption[] {
  if (!Array.isArray(value)) return false;
  return value.every((row) => {
    if (!row || typeof row !== "object") return false;
    const item = row as Partial<TenantAuthPickOption>;
    return (
      typeof item.slug === "string" &&
      typeof item.legalName === "string" &&
      typeof item.roleLabel === "string"
    );
  });
}

export function normalizeTenantPickList(value: TenantAuthPickOption[]): TenantAuthPickOption[] {
  return value.map((item) => ({
    ...item,
    initials:
      item.initials?.trim() ||
      item.legalName
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() ?? "")
        .join("") ||
      "?",
  }));
}

/** Nest devolve `{ message, code, tenants }` no topo; em alguns proxies fica aninhado em `message`. */
export function parseTenantAmbiguousResponse(data: unknown): TenantAuthPickOption[] | null {
  if (!data || typeof data !== "object") return null;
  const row = data as Record<string, unknown>;

  if (row.code === TENANT_AMBIGUOUS_CODE && isTenantPickList(row.tenants)) {
    return normalizeTenantPickList(row.tenants);
  }

  const nested = row.message;
  if (typeof nested === "object" && nested !== null && !Array.isArray(nested)) {
    const body = nested as Record<string, unknown>;
    if (body.code === TENANT_AMBIGUOUS_CODE && isTenantPickList(body.tenants)) {
      return normalizeTenantPickList(body.tenants);
    }
  }

  return null;
}

export function tenantAmbiguousInfoMessage(): string {
  return "Este email existe em várias entidades. Escolha em qual pretende entrar.";
}
