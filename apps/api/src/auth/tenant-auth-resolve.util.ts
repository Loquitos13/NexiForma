export const TENANT_AUTH_AMBIGUOUS_CODE = "TENANT_AMBIGUOUS";

export type TenantAuthPick = {
  slug: string;
  legalName: string;
  role: string;
  roleLabel: string;
  logoUrl?: string;
  initials: string;
};

const TENANT_USER_ROLE_LABELS: Record<string, string> = {
  ADMIN: "Gestor",
  COORDENADOR_COMERCIAL: "Coordenador Comercial",
  COORDENADOR_PEDAGOGICO: "Coordenador Pedagógico",
  COORDENADOR_FINANCEIRO: "Coordenador Financeiro",
  COORDENADOR: "Coordenador Pedagógico", // legado
  FINANCEIRO: "Coordenador Financeiro", // legado
  COMERCIAL: "Comercial",
  FORMADOR: "Formador",
  FORMANDO: "Formando",
};

export function tenantUserRoleLabel(role: string): string {
  return TENANT_USER_ROLE_LABELS[role] ?? role;
}

import {
  resolveTenantPublicBranding,
  tenantDisplayInitials,
} from "./tenant-branding.util";

export function buildTenantAuthPick(input: {
  slug: string;
  legalName: string;
  role: string;
  metadata?: unknown;
  logoUrl?: string;
  initials?: string;
}): TenantAuthPick {
  const branding = input.metadata
    ? resolveTenantPublicBranding(input.metadata, input.legalName, input.slug)
    : null;
  const displayName = branding?.displayName ?? (input.legalName || input.slug);
  return {
    slug: input.slug,
    legalName: displayName,
    role: input.role,
    roleLabel: tenantUserRoleLabel(input.role),
    logoUrl: input.logoUrl ?? branding?.logoUrl,
    initials: input.initials ?? branding?.initials ?? tenantDisplayInitials(displayName),
  };
}

export function isTenantOperational(status: string): boolean {
  return status !== "SUSPENDED" && status !== "ARCHIVED";
}

export function normalizeAuthEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Nest/Express pode devolver array quando o query param vem repetido (?slug=a&slug=b). */
export function normalizeQueryParam(value: unknown): string {
  if (Array.isArray(value)) {
    return String(value[0] ?? "").trim();
  }
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

export function buildTenantAmbiguousPayload(tenants: TenantAuthPick[]) {
  const unique = new Map<string, TenantAuthPick>();
  for (const t of tenants) {
    if (!t.slug.trim()) continue;
    unique.set(
      t.slug,
      buildTenantAuthPick({
        slug: t.slug,
        legalName: t.legalName,
        role: t.role,
        logoUrl: t.logoUrl,
        initials: t.initials,
      }),
    );
  }
  return {
    message:
      "Este email existe em várias entidades. Escolha a entidade ou utilize o link enviado pelo gestor.",
    code: TENANT_AUTH_AMBIGUOUS_CODE,
    tenants: [...unique.values()],
  };
}

export function tenantLoginLockoutKey(email: string, tenantSlug?: string | null): string {
  const normalizedEmail = normalizeAuthEmail(email);
  const slug = tenantSlug?.trim().toLowerCase() ?? "";
  return slug ? `${slug}:${normalizedEmail}` : `email:${normalizedEmail}`;
}
