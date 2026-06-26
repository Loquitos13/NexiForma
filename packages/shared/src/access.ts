import type { JwtKind, JwtRole } from "./index";

/** Hierarquia de papéis (maior = mais permissões no tenant). Comercial fica fora desta escala. */
export const ROLE_ORDER: Record<JwtRole, number> = {
  formando: 0,
  formador: 1,
  comercial: 1,
  tenant_manager: 2,
  super_admin: 3,
};

export const CRM_PORTAL_PATHS = [
  "/portal/crm",
  "/portal/entidades",
  "/portal/parceiros",
  "/portal/propostas",
  "/portal/contratos",
  "/portal/crm/leads",
  "/portal/crm/faturas",
  "/portal/crm/faturacao",
] as const;

export function roleSatisfies(userRole: JwtRole | null | undefined, required: JwtRole): boolean {
  if (!userRole) return false;
  if (userRole === "comercial") return required === "comercial";
  if (required === "comercial") return false;
  return (ROLE_ORDER[userRole] ?? 0) >= (ROLE_ORDER[required] ?? 0);
}

export function isTenantManager(role: JwtRole | null | undefined): boolean {
  return role === "tenant_manager";
}

export function isComercial(role: JwtRole | null | undefined): boolean {
  return role === "comercial";
}

export function canManageCrm(role: JwtRole | null | undefined): boolean {
  return role === "tenant_manager" || role === "comercial";
}

export function isFormador(role: JwtRole | null | undefined): boolean {
  return role === "formador";
}

export function isFormando(role: JwtRole | null | undefined): boolean {
  return role === "formando";
}

export function isSuperAdmin(role: JwtRole | null | undefined, kind?: JwtKind | null): boolean {
  return role === "super_admin" && (kind === undefined || kind === null || kind === "platform");
}

export function isTenantStaff(role: JwtRole | null | undefined): boolean {
  return role === "tenant_manager" || role === "formador";
}

export function isCrmPortalPath(pathname: string): boolean {
  return CRM_PORTAL_PATHS.some(
    (href) => pathname === href || pathname.startsWith(`${href}/`),
  );
}

/** Dashboard por defeito após login. */
export function defaultDashboardPath(
  role: JwtRole | null | undefined,
  kind: JwtKind | null | undefined,
): string {
  if (isSuperAdmin(role, kind)) return "/plataforma";
  if (isFormando(role)) return "/portal/formando";
  if (isComercial(role)) return "/portal/crm";
  return "/portal";
}

/** Valida destino `next` após autenticação. */
export function resolvePostLoginPath(
  role: JwtRole | null | undefined,
  kind: JwtKind | null | undefined,
  next: string | null | undefined,
): string {
  const fallback = defaultDashboardPath(role, kind);
  if (!next) return fallback;

  if (next.startsWith("/plataforma")) {
    return isSuperAdmin(role, kind) ? next : fallback;
  }

  if (!next.startsWith("/portal")) return fallback;

  if (isSuperAdmin(role, kind)) return "/plataforma";

  if (isFormando(role)) {
    return next.startsWith("/portal/formando") || next.startsWith("/portal/demo/")
      ? next
      : "/portal/formando";
  }

  if (isComercial(role)) {
    return isCrmPortalPath(next) ? next : "/portal/crm";
  }

  return next;
}

export function canAccessPlatformArea(
  role: JwtRole | null | undefined,
  kind: JwtKind | null | undefined,
): boolean {
  return isSuperAdmin(role, kind);
}

export function canAccessPortalArea(
  role: JwtRole | null | undefined,
  kind: JwtKind | null | undefined,
  impersonating?: boolean,
): boolean {
  if (!role) return false;
  if (isSuperAdmin(role, kind) && !impersonating) return false;
  if (kind === "platform" && !impersonating) return false;
  return (
    role === "tenant_manager" ||
    role === "comercial" ||
    role === "formador" ||
    role === "formando" ||
    !!impersonating
  );
}
