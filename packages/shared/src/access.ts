import type { JwtKind, JwtRole } from "./index";
import {
  defaultPortalHome,
  isPortalPathAllowedByEntitlements,
} from "./billing/module-access";
import type { TenantEntitlements } from "./billing/entitlements";

/**
 * Hierarquia de papéis (maior = mais permissões genéricas).
 * Coordenadores ficam abaixo do gestor e não herdam `tenant_manager` via ordem.
 */
export const ROLE_ORDER: Record<JwtRole, number> = {
  formando: 0,
  formador: 1,
  comercial: 1,
  coordenador_comercial: 2,
  coordenador_pedagogico: 2,
  coordenador_financeiro: 2,
  tenant_manager: 3,
  super_admin: 4,
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
  "/portal/calendario",
  "/portal/fluxo",
] as const;

const FORMACAO_PORTAL_PREFIXES = [
  "/portal/calendario",
  "/portal/cursos",
  "/portal/acoes",
  "/portal/catalogo-ufcd",
  "/portal/conteudos",
  "/portal/formacoes",
  "/portal/matriculas",
  "/portal/formandos",
  "/portal/formadores",
  "/portal/avaliacoes",
  "/portal/progresso-lms",
  "/portal/compliance",
  "/portal/dossie",
  "/portal/certificados",
  "/portal/sigo",
  "/portal/integracoes",
  "/portal/documentos",
  "/portal/fluxo",
  "/portal/rgpd",
  "/portal/formador",
] as const;

export function roleSatisfies(userRole: JwtRole | null | undefined, required: JwtRole): boolean {
  if (!userRole) return false;
  if (userRole === required) return true;

  // Comercial (agente): só rotas/roles comerciais
  if (userRole === "comercial") return required === "comercial";

  // Pedidos de papel comercial: gestor e coordenador comercial também
  if (required === "comercial") {
    return userRole === "tenant_manager" || userRole === "coordenador_comercial";
  }

  // Coordenadores especializados: gestor também satisfaz
  if (required === "coordenador_comercial") {
    return userRole === "tenant_manager" || userRole === "coordenador_comercial";
  }
  if (required === "coordenador_pedagogico") {
    return userRole === "tenant_manager" || userRole === "coordenador_pedagogico";
  }
  if (required === "coordenador_financeiro") {
    return userRole === "tenant_manager" || userRole === "coordenador_financeiro";
  }

  // Coordenador comercial: CRM (comercial) + nada de formação via hierarquia
  if (userRole === "coordenador_comercial") {
    return required === "formando";
  }

  // Coordenador financeiro: não herda formador/comercial
  if (userRole === "coordenador_financeiro") {
    return required === "formando";
  }

  // Coordenador pedagógico: herda formador/formando; não é gestor global
  if (userRole === "coordenador_pedagogico") {
    if (required === "tenant_manager" || required === "super_admin") {
      return false;
    }
    return (ROLE_ORDER[userRole] ?? 0) >= (ROLE_ORDER[required] ?? 0);
  }

  // Gestor: hierarquia clássica (excepto comercial, tratado acima)
  if (userRole === "tenant_manager" || userRole === "super_admin" || userRole === "formador") {
    return (ROLE_ORDER[userRole] ?? 0) >= (ROLE_ORDER[required] ?? 0);
  }

  return (ROLE_ORDER[userRole] ?? 0) >= (ROLE_ORDER[required] ?? 0);
}

export function isTenantManager(role: JwtRole | null | undefined): boolean {
  return role === "tenant_manager";
}

export function isCoordenadorPedagogico(role: JwtRole | null | undefined): boolean {
  return role === "coordenador_pedagogico";
}

export function isCoordenadorComercial(role: JwtRole | null | undefined): boolean {
  return role === "coordenador_comercial";
}

export function isCoordenadorFinanceiro(role: JwtRole | null | undefined): boolean {
  return role === "coordenador_financeiro";
}

/** Gestor ou coordenador pedagógico - operações de formação / conclusão de acções. */
export function canManageFormacao(role: JwtRole | null | undefined): boolean {
  return role === "tenant_manager" || role === "coordenador_pedagogico";
}

export function isComercial(role: JwtRole | null | undefined): boolean {
  return role === "comercial";
}

export function canManageCrm(role: JwtRole | null | undefined): boolean {
  return (
    role === "tenant_manager" ||
    role === "coordenador_comercial" ||
    role === "comercial"
  );
}

/** Papel com gestão de faturação (sem entitlements). */
export function canManageFaturacao(role: JwtRole | null | undefined): boolean {
  return role === "tenant_manager" || role === "coordenador_financeiro";
}

/** Faturação AT: gestor ou coordenador financeiro + entitlement. */
export function canAccessFaturacaoPortal(
  role: JwtRole | null | undefined,
  entitlements?: TenantEntitlements | null,
): boolean {
  if (!entitlements?.canAccessFaturacao) return false;
  return canManageFaturacao(role);
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
  return (
    role === "tenant_manager" ||
    role === "coordenador_pedagogico" ||
    role === "coordenador_comercial" ||
    role === "coordenador_financeiro" ||
    role === "formador"
  );
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

/** Rotas CRM acessíveis ao papel comercial (sem faturação AT nem dashboard gestor). */
export function isComercialCrmPortalPath(pathname: string): boolean {
  if (isCrmFaturacaoPortalPath(pathname)) return false;
  const path = normalizePortalPathname(pathname);
  if (path === "/portal/crm") return false;
  if (path === "/portal/crm/config" || path.startsWith("/portal/crm/config/")) return false;
  if (path === "/portal/crm/audit" || path.startsWith("/portal/crm/audit/")) return false;
  if (path === "/portal/contratos" || path.startsWith("/portal/contratos/")) return false;
  return CRM_PORTAL_PATHS.some(
    (href) => path === href || path.startsWith(`${href}/`),
  );
}

/** Dashboard / landing por defeito após login, por papel. */
export function roleLandingPath(
  role: JwtRole | null | undefined,
  kind: JwtKind | null | undefined,
): string {
  if (isSuperAdmin(role, kind)) return "/plataforma";
  if (isFormando(role)) return "/portal/formando";
  if (isCoordenadorComercial(role)) return "/portal/crm";
  if (isComercial(role)) return "/portal/crm/leads";
  if (isCoordenadorFinanceiro(role)) return "/portal/crm/faturas";
  if (isFormador(role) || isTenantManager(role) || isCoordenadorPedagogico(role)) return "/portal";
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
  "/portal/formador",
  "/portal/progresso-lms",
  "/portal/fluxo",
  "/portal/rgpd",
] as const;

export function isFormandoPortalPath(path: string): boolean {
  const normalized = normalizePortalPathname(path);
  return normalized === "/portal/formando" || normalized.startsWith("/portal/formando/");
}

/** Rotas partilhadas acessíveis ao formando fora de `/portal/formando/*`. */
export function isFormandoSharedPortalPath(path: string): boolean {
  const normalized = normalizePortalPathname(path);
  return (
    normalized === "/portal/fluxo" ||
    normalized.startsWith("/portal/fluxo/") ||
    normalized === "/portal/suporte" ||
    normalized.startsWith("/portal/suporte/")
  );
}

function normalizePortalPathname(path: string): string {
  const base = path.split("?")[0]?.split("#")[0] ?? path;
  if (base.length > 1 && base.endsWith("/")) return base.slice(0, -1);
  return base;
}

function pathMatchesPrefixes(path: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
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
    return isFormandoPortalPath(path) || isFormandoSharedPortalPath(path);
  }

  if (isComercial(role)) {
    if (isFormandoPortalPath(path)) return false;
    return path.startsWith("/portal/rgpd") || isComercialCrmPortalPath(path);
  }

  if (isCoordenadorComercial(role)) {
    if (isFormandoPortalPath(path)) return false;
    if (isCrmFaturacaoPortalPath(path)) return false;
    if (
      path.startsWith("/portal/utilizadores") ||
      path.startsWith("/portal/billing") ||
      path.startsWith("/portal/configuracoes") ||
      path.startsWith("/portal/enterprise")
    ) {
      return false;
    }
    return (
      path.startsWith("/portal/rgpd") ||
      path.startsWith("/portal/notificacoes") ||
      isCrmPortalPath(path)
    );
  }

  if (isCoordenadorFinanceiro(role)) {
    if (isFormandoPortalPath(path)) return false;
    if (
      path.startsWith("/portal/utilizadores") ||
      path.startsWith("/portal/billing") ||
      path.startsWith("/portal/configuracoes") ||
      path.startsWith("/portal/enterprise") ||
      path.startsWith("/portal/crm/leads") ||
      path.startsWith("/portal/crm/interaccoes") ||
      path.startsWith("/portal/crm/sugestoes-ia") ||
      path.startsWith("/portal/propostas") ||
      path.startsWith("/portal/contratos")
    ) {
      return false;
    }
    return (
      path.startsWith("/portal/rgpd") ||
      path.startsWith("/portal/notificacoes") ||
      isCrmFaturacaoPortalPath(path) ||
      path === "/portal/clientes" ||
      path.startsWith("/portal/clientes/")
    );
  }

  if (isCoordenadorPedagogico(role)) {
    if (isFormandoPortalPath(path)) return false;
    if (
      path.startsWith("/portal/crm") ||
      path.startsWith("/portal/propostas") ||
      path.startsWith("/portal/contratos") ||
      path.startsWith("/portal/clientes") ||
      path.startsWith("/portal/parceiros") ||
      path.startsWith("/portal/utilizadores") ||
      path.startsWith("/portal/billing") ||
      path.startsWith("/portal/configuracoes") ||
      path.startsWith("/portal/enterprise")
    ) {
      return false;
    }
    if (path === "/portal") return true;
    return (
      path.startsWith("/portal/notificacoes") ||
      path.startsWith("/portal/suporte") ||
      path.startsWith("/portal/rgpd") ||
      pathMatchesPrefixes(path, FORMACAO_PORTAL_PREFIXES)
    );
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

/** Valida destino `next` após autenticação (RBAC + entitlements quando disponíveis). */
export function resolvePostLoginPath(
  role: JwtRole | null | undefined,
  kind: JwtKind | null | undefined,
  next: string | null | undefined,
  entitlements?: TenantEntitlements | null,
): string {
  const landing =
    entitlements && role && !isSuperAdmin(role, kind)
      ? defaultPortalHome(entitlements, role)
      : roleLandingPath(role, kind);

  if (!next) return landing;

  const normalized = normalizePortalPathname(next);

  if (normalized.startsWith("/plataforma")) {
    return isSuperAdmin(role, kind) ? next : landing;
  }

  if (!normalized.startsWith("/portal")) return landing;

  if (isSuperAdmin(role, kind)) return "/plataforma";

  if (!isPortalPathAllowedByRole(normalized, role)) {
    return landing;
  }

  if (entitlements && !isPortalPathAllowedByEntitlements(normalized, entitlements, role)) {
    return landing;
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
    role === "coordenador_comercial" ||
    role === "coordenador_pedagogico" ||
    role === "coordenador_financeiro" ||
    role === "comercial" ||
    role === "formador" ||
    role === "formando" ||
    !!impersonating
  );
}
