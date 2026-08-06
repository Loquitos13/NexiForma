/** RBAC mínimo para Edge middleware (sem importar @nexiforma/shared). */
export type MiddlewareJwtRole =
  | "super_admin"
  | "tenant_manager"
  | "comercial"
  | "formador"
  | "formando";

export type MiddlewareJwtKind = "platform" | "tenant";

export type MiddlewareJwtSlice = {
  role?: MiddlewareJwtRole;
  kind?: MiddlewareJwtKind;
  impersonating?: boolean;
};

function isSuperAdmin(
  role: MiddlewareJwtRole | null | undefined,
  kind: MiddlewareJwtKind | null | undefined,
): boolean {
  return role === "super_admin" && (kind === undefined || kind === null || kind === "platform");
}

export function canAccessPlatformArea(
  role: MiddlewareJwtRole | null | undefined,
  kind: MiddlewareJwtKind | null | undefined,
): boolean {
  return isSuperAdmin(role, kind);
}

export function canAccessPortalArea(
  role: MiddlewareJwtRole | null | undefined,
  kind: MiddlewareJwtKind | null | undefined,
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

const CRM_FATURACAO_PREFIXES = ["/portal/crm/faturas", "/portal/crm/faturacao"] as const;
const CRM_MANAGER_ONLY_PREFIXES = [
  "/portal/crm/faturas",
  "/portal/crm/faturacao",
  "/portal/crm/config",
  "/portal/crm/audit",
] as const;
const FORMADOR_PORTAL_PREFIXES = [
  "/portal/calendario",
  "/portal/cursos",
  "/portal/acoes",
  "/portal/catalogo-ufcd",
  "/portal/conteudos",
  "/portal/formador",
  "/portal/progresso-lms",
  "/portal/fluxo",
  "/portal/rgpd",
] as const;
const COMERCIAL_CRM_PREFIXES = [
  "/portal/crm",
  "/portal/clientes",
  "/portal/entidades",
  "/portal/parceiros",
  "/portal/propostas",
  "/portal/contratos",
  "/portal/calendario",
  "/portal/fluxo",
] as const;

function normalizePortalPath(pathname: string): string {
  const base = pathname.split("?")[0]?.split("#")[0] ?? pathname;
  if (base.length > 1 && base.endsWith("/")) return base.slice(0, -1);
  return base;
}

function pathMatches(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * RBAC por pathname no Edge (sem entitlements - esses ficam no layout).
 * Bloqueia papéis sem acesso a áreas CRM/faturação antes do BFF.
 */
export function isPortalPathAllowedByRoleEdge(
  pathname: string,
  role: MiddlewareJwtRole | null | undefined,
): boolean {
  const path = normalizePortalPath(pathname);
  if (!role) return false;
  if (path.startsWith("/portal/demo/")) return true;

  if (role === "formando") {
    return (
      path === "/portal/formando" ||
      path.startsWith("/portal/formando/") ||
      path === "/portal/fluxo" ||
      path.startsWith("/portal/fluxo/") ||
      path === "/portal/suporte" ||
      path.startsWith("/portal/suporte/")
    );
  }

  if (role === "comercial") {
    if (path === "/portal/formando" || path.startsWith("/portal/formando/")) return false;
    if (path === "/portal/crm") return false;
    if (CRM_MANAGER_ONLY_PREFIXES.some((p) => pathMatches(path, p))) return false;
    if (path.startsWith("/portal/rgpd")) return true;
    return COMERCIAL_CRM_PREFIXES.some((p) => pathMatches(path, p));
  }

  if (role === "formador") {
    if (path === "/portal/formando" || path.startsWith("/portal/formando/")) return false;
    if (path === "/portal") return true;
    return FORMADOR_PORTAL_PREFIXES.some((p) => pathMatches(path, p));
  }

  if (role === "tenant_manager") {
    if (path === "/portal/formando" || path.startsWith("/portal/formando/")) return false;
    return path === "/portal" || path.startsWith("/portal/");
  }

  return false;
}

export function isCrmFaturacaoPathEdge(pathname: string): boolean {
  const path = normalizePortalPath(pathname);
  return CRM_FATURACAO_PREFIXES.some((p) => pathMatches(path, p));
}
