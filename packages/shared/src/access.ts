import type { JwtKind, JwtRole } from "./index";

/** Hierarquia de papéis (maior = mais permissões no tenant). Comercial fica fora desta escala. */
export const ROLE_ORDER: Record<JwtRole, number> = {
  formando: 0,
  formador: 1,
  comercial: 1,
  tenant_manager: 2,
  super_admin: 3,
};

export const CRM_FATURACAO_PORTAL_PATHS = [
  "/portal/crm/faturas",
  "/portal/crm/faturacao",
] as const;

export const CRM_PORTAL_PATHS = [
  "/portal/crm",
  "/portal/clientes",
  "/portal/entidades",
  "/portal/parceiros",
  "/portal/propostas",
  "/portal/contratos",
  "/portal/crm/leads",
  "/portal/crm/interaccoes",
  "/portal/crm/sugestoes-ia",
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

export function isCrmFaturacaoPortalPath(pathname: string): boolean {
  return CRM_FATURACAO_PORTAL_PATHS.some(
    (href) => pathname === href || pathname.startsWith(`${href}/`),
  );
}

export function isCrmPortalPath(pathname: string): boolean {
  return (
    CRM_PORTAL_PATHS.some(
      (href) => pathname === href || pathname.startsWith(`${href}/`),
    ) ||
    isCrmFaturacaoPortalPath(pathname)
  );
}

/** Rotas CRM acessíveis ao papel comercial (sem faturação). */
export function isComercialCrmPortalPath(pathname: string): boolean {
  if (isCrmFaturacaoPortalPath(pathname)) return false;
  return CRM_PORTAL_PATHS.some(
    (href) => pathname === href || pathname.startsWith(`${href}/`),
  );
}

/** Dashboard / landing por defeito após login, por papel. */
export function roleLandingPath(
  role: JwtRole | null | undefined,
  kind: JwtKind | null | undefined,
): string {
  if (isSuperAdmin(role, kind)) return "/plataforma";
  if (isFormando(role)) return "/portal/formando";
  if (isComercial(role)) return "/portal/crm";
  if (isFormador(role) || isTenantManager(role)) return "/portal";
  return "/portal";
}

/** @deprecated Preferir `roleLandingPath`. */
export function defaultDashboardPath(
  role: JwtRole | null | undefined,
  kind: JwtKind | null | undefined,
): string {
  return roleLandingPath(role, kind);
}

const FORMADOR_PORTAL_PREFIXES = [
  "/portal/calendario",
  "/portal/cursos",
  "/portal/acoes",
  "/portal/catalogo-ufcd",
  "/portal/conteudos",
  "/portal/rgpd",
] as const;

export function isFormandoPortalPath(path: string): boolean {
  const normalized = normalizePortalPathname(path);
  return normalized === "/portal/formando" || normalized.startsWith("/portal/formando/");
}

function normalizePortalPathname(path: string): string {
  const base = path.split("?")[0]?.split("#")[0] ?? path;
  if (base.length > 1 && base.endsWith("/")) return base.slice(0, -1);
  return base;
}

/** RBAC de rotas do portal (sem entitlements - usado no redirect pós-login). */
export function isPortalPathAllowedByRole(
  pathname: string,
  role: JwtRole | null | undefined,
): boolean {
  const path = normalizePortalPathname(pathname);
  if (!role) return false;

  if (path.startsWith("/portal/demo/")) return true;

  if (isSuperAdmin(role)) {
    return path.startsWith("/plataforma");
  }

  if (isFormando(role)) {
    return isFormandoPortalPath(path);
  }

  if (isComercial(role)) {
    if (isFormandoPortalPath(path)) return false;
    return path.startsWith("/portal/rgpd") || isComercialCrmPortalPath(path);
  }

  if (isTenantManager(role)) {
    if (isFormandoPortalPath(path)) return false;
    return path === "/portal" || path.startsWith("/portal/");
  }

  if (isFormador(role)) {
    if (isFormandoPortalPath(path)) return false;
    if (path === "/portal") return true;
    return FORMADOR_PORTAL_PREFIXES.some(
      (prefix) => path === prefix || path.startsWith(`${prefix}/`),
    );
  }

  return false;
}

/** Valida destino `next` após autenticação. */
export function resolvePostLoginPath(
  role: JwtRole | null | undefined,
  kind: JwtKind | null | undefined,
  next: string | null | undefined,
): string {
  const landing = roleLandingPath(role, kind);
  if (!next) return landing;

  const normalized = normalizePortalPathname(next);

  if (normalized.startsWith("/plataforma")) {
    return isSuperAdmin(role, kind) ? next : landing;
  }

  if (!normalized.startsWith("/portal")) return landing;

  if (isSuperAdmin(role, kind)) return "/plataforma";

  if (isPortalPathAllowedByRole(normalized, role)) {
    return next;
  }

  return landing;
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
