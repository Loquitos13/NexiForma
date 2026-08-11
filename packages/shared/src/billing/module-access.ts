import type { JwtKind, JwtRole } from "../index";
import type { TenantEntitlements } from "./entitlements";

/** Prefixos API sempre permitidos a utilizadores tenant autenticados. */
export const API_ALWAYS_ALLOWED_PREFIXES = [
  "auth",
  "consent",
  "billing",
  "health",
  "settings",
  "users",
  "notificacoes",
  "portal",
  "mail",
  "guide",
] as const;

/** Prefixos API públicos (sem JWT tenant). */
export const API_PUBLIC_PREFIXES = ["public", "docs", "verificar"] as const;

const CORE_FORMATION_API = [
  "cursos",
  "acoes-formacao",
  "turmas",
  "matriculas",
  "formandos",
  "formadores",
  "cronogramas",
  "folhas-presenca",
  "presencas",
  "sumarios",
  "dossie-pedagogico",
  "compliance",
  "certificados",
  "sigo",
  "catalogo-ufcd",
  "avaliacoes",
  "conteudos-lms",
  "documentos",
  "inspecao",
  "formacoes",
  "quizzes",
  "verificacao",
  "rgpd",
] as const;

const CRM_API = ["crm", "entidades-cliente", "propostas"] as const;

function isFaturacaoPortalPath(pathname: string): boolean {
  return (
    pathname === "/portal/crm/faturas" ||
    pathname.startsWith("/portal/crm/faturas/") ||
    pathname === "/portal/crm/faturacao" ||
    pathname.startsWith("/portal/crm/faturacao/")
  );
}

/** Rotas `crm/*` de faturação AT (módulo add-on; não exige CRM comercial). */
function isFaturacaoCrmApiPath(normalized: string): boolean {
  if (/^crm\/propostas\/[^/]+\/faturar/.test(normalized)) return true;
  return (
    normalized.startsWith("crm/faturas") ||
    normalized.startsWith("crm/config/faturacao")
  );
}

function isCrmCommercialApiPath(normalized: string): boolean {
  const seg = firstSegment(normalized);
  if (seg === "propostas" || seg === "entidades-cliente" || seg === "calendario") {
    return true;
  }
  if (seg !== "crm") return false;
  return !isFaturacaoCrmApiPath(normalized);
}

/** Leitura do estado Teams/Zoom (sem segredos) - CRM e formação. */
function isIntegracoesTeamsReadinessPath(normalized: string): boolean {
  return (
    normalized === "integracoes/disponibilidade" ||
    normalized.startsWith("integracoes/disponibilidade/")
  );
}

function teamsReadinessModuleAllowed(ent: TenantEntitlements): boolean {
  return ent.canAccessFormacaoTeams || ent.canAccessCrm;
}

const TEAMS_API = [
  "integracoes",
  "sessoes-formacao",
  "assiduidade",
  "lms",
  "formando-portal",
] as const;

/** APIs usadas pelo portal do formando (escopo limitado nos serviços). */
const FORMANDO_PORTAL_API = [
  "lms",
  "conteudos-lms",
  "calendario",
  "quizzes",
  "certificados",
  "documentos",
  "formacoes",
  "formando-portal",
  "notificacoes",
  /** Check-in de presença via QR (sessão presencial / híbrida). */
  "presenca-checkin",
] as const;

const IA_API = ["relatorios"] as const;

const ENTERPRISE_API = ["enterprise"] as const;

/** Portal: sempre acessível (administração mínima). */
export const PORTAL_ALWAYS_PATHS = [
  "/portal/rgpd",
  "/portal/billing",
  "/portal/configuracoes",
  "/portal/utilizadores",
  "/portal/notificacoes",
  "/acesso-negado",
] as const;

function firstSegment(path: string): string {
  return path.replace(/^\/+/, "").split("/").filter(Boolean)[0] ?? "";
}

export function normalizeApiPath(rawPath: string): string {
  return rawPath
    .replace(/^\/api\/v1\/?/i, "")
    .replace(/^\/v1\/?/i, "")
    .replace(/^v1\/?/i, "")
    .replace(/^\/+/, "");
}

export function isApiPathPublic(rawPath: string): boolean {
  const seg = firstSegment(normalizeApiPath(rawPath));
  return (API_PUBLIC_PREFIXES as readonly string[]).includes(seg);
}

export function isApiPathExempt(rawPath: string): boolean {
  const normalized = normalizeApiPath(rawPath);
  const seg = firstSegment(normalized);
  if ((API_PUBLIC_PREFIXES as readonly string[]).includes(seg)) return true;
  if (seg === "billing" && normalized.includes("webhook")) return true;
  if (seg === "auth") return true;
  if (seg === "health") return true;
  if (seg === "rgpd" && normalized.endsWith("/me/export")) return true;
  return false;
}

type AccessOpts = {
  role?: JwtRole | null;
  kind?: JwtKind | null;
};

function segmentAllowed(segment: string, ent: TenantEntitlements, normalizedPath: string): boolean {
  if ((CORE_FORMATION_API as readonly string[]).includes(segment)) {
    return ent.canAccessCoreFormation;
  }
  if (segment === "entidades-cliente") {
    return ent.canAccessCrm || ent.canAccessFaturacao;
  }
  if (isCrmCommercialApiPath(normalizedPath)) {
    return ent.canAccessCrm;
  }
  if (isFaturacaoCrmApiPath(normalizedPath)) {
    return ent.canAccessFaturacao;
  }
  if (segment === "crm" || (CRM_API as readonly string[]).includes(segment)) {
    return ent.canAccessCrm;
  }
  if (segment === "integracoes") {
    if (/^integracoes\/moodle/.test(normalizedPath)) {
      return ent.canAccessCoreFormation;
    }
    if (isIntegracoesTeamsReadinessPath(normalizedPath)) {
      return teamsReadinessModuleAllowed(ent);
    }
    return ent.canAccessFormacaoTeams;
  }
  if ((TEAMS_API as readonly string[]).includes(segment)) {
    return ent.canAccessFormacaoTeams;
  }
  if ((IA_API as readonly string[]).includes(segment)) {
    return ent.canAccessRelatoriosDashboard;
  }
  if ((ENTERPRISE_API as readonly string[]).includes(segment)) {
    return true;
  }
  if ((API_ALWAYS_ALLOWED_PREFIXES as readonly string[]).includes(segment)) {
    if (segment === "guide") {
      return ent.canAccessInteligenciaIa || ent.canAccessCoreFormation;
    }
    return true;
  }
  if (ent.isModularSubscription) return false;
  return true;
}

/** Bloqueia API fora dos módulos subscritos (estrito em plano modular). */
export function isApiPathAllowed(
  rawPath: string,
  ent: TenantEntitlements,
  opts?: AccessOpts,
): boolean {
  if (opts?.kind === "platform" && opts.role === "super_admin") return true;

  const normalized = normalizeApiPath(rawPath);
  const segment = firstSegment(normalized);

  if (opts?.role === "formando") {
    if (segment === "consent" || segment === "auth" || segment === "rgpd") return true;
    if ((FORMANDO_PORTAL_API as readonly string[]).includes(segment)) {
      return ent.canAccessCoreFormation || ent.canAccessFormacaoTeams;
    }
    return false;
  }

  if (opts?.role === "formador") {
    if (segment === "consent" || segment === "auth" || segment === "rgpd") return true;
    if (normalized === "formadores/me" || normalized.startsWith("formadores/me/")) {
      return ent.canAccessCoreFormation || ent.canAccessFormacaoTeams;
    }
  }

  if (opts?.role === "comercial") {
    if (isFaturacaoCrmApiPath(normalized)) return false;
    if (isIntegracoesTeamsReadinessPath(normalized)) {
      return teamsReadinessModuleAllowed(ent);
    }
    if (!isCrmCommercialApiPath(normalized)) {
      if ((API_ALWAYS_ALLOWED_PREFIXES as readonly string[]).includes(segment)) {
        return segment !== "guide" || ent.canAccessInteligenciaIa;
      }
      return false;
    }
    return ent.canAccessCrm;
  }

  return segmentAllowed(segment, ent, normalized);
}

function portalPrefixAllowed(pathname: string, ent: TenantEntitlements): boolean {
  if (pathname === "/portal" || pathname === "/portal/") {
    return true;
  }

  const rules: Array<{ prefix: string; allow: (e: TenantEntitlements) => boolean }> = [
    { prefix: "/portal/crm/faturas", allow: (e) => e.canAccessFaturacao },
    { prefix: "/portal/crm/faturacao", allow: (e) => e.canAccessFaturacao },
    { prefix: "/portal/crm", allow: (e) => e.canAccessCrm },
    { prefix: "/portal/clientes", allow: (e) => e.canAccessCrm || e.canAccessFaturacao },
    { prefix: "/portal/parceiros", allow: (e) => e.canAccessCrm },
    { prefix: "/portal/propostas", allow: (e) => e.canAccessCrm },
    { prefix: "/portal/contratos", allow: (e) => e.canAccessCrm },
    {
      prefix: "/portal/fluxo",
      allow: (e) => e.canAccessCoreFormation || e.canAccessFormacaoTeams || e.canAccessCrm,
    },
    {
      prefix: "/portal/calendario",
      allow: (e) => e.canAccessCoreFormation || e.canAccessFormacaoTeams || e.canAccessCrm,
    },
    { prefix: "/portal/relatorios", allow: (e) => e.canAccessRelatoriosDashboard },
    { prefix: "/portal/cursos", allow: (e) => e.canAccessCoreFormation },
    { prefix: "/portal/formacoes", allow: (e) => e.canAccessCoreFormation },
    { prefix: "/portal/acoes", allow: (e) => e.canAccessCoreFormation },
    { prefix: "/portal/catalogo-ufcd", allow: (e) => e.canAccessCoreFormation },
    { prefix: "/portal/matriculas", allow: (e) => e.canAccessCoreFormation },
    { prefix: "/portal/formandos", allow: (e) => e.canAccessCoreFormation },
    /** Self-service do formador (antes de /portal/formadores). */
    {
      prefix: "/portal/formador",
      allow: (e) => e.canAccessCoreFormation || e.canAccessFormacaoTeams,
    },
    { prefix: "/portal/formadores", allow: (e) => e.canAccessCoreFormation },
    { prefix: "/portal/avaliacoes", allow: (e) => e.canAccessCoreFormation },
    { prefix: "/portal/conteudos", allow: (e) => e.canAccessCoreFormation },
    { prefix: "/portal/documentos", allow: (e) => e.canAccessCoreFormation },
    { prefix: "/portal/compliance", allow: (e) => e.canAccessCoreFormation },
    { prefix: "/portal/dossie", allow: (e) => e.canAccessCoreFormation },
    { prefix: "/portal/certificados", allow: (e) => e.canAccessCoreFormation },
    { prefix: "/portal/sigo", allow: (e) => e.canAccessCoreFormation },
    { prefix: "/portal/integracoes", allow: (e) => e.canAccessFormacaoTeams || e.canAccessCoreFormation },
    { prefix: "/portal/enterprise", allow: (e) => e.canAccessEnterpriseFeatures },
    { prefix: "/portal/formando", allow: (e) => e.canAccessCoreFormation || e.canAccessFormacaoTeams },
    { prefix: "/portal/demo", allow: () => true },
  ];

  for (const rule of rules) {
    if (pathname === rule.prefix || pathname.startsWith(`${rule.prefix}/`)) {
      return rule.allow(ent);
    }
  }

  if (ent.isModularSubscription) return false;
  return true;
}

export function isPortalPathAllowedByEntitlements(
  pathname: string,
  ent: TenantEntitlements | null | undefined,
  role?: JwtRole | null,
): boolean {
  if (role === "comercial" && isFaturacaoPortalPath(pathname)) {
    return false;
  }

  if (
    role === "comercial" &&
    ent?.canAccessCrm &&
    (pathname === "/portal/calendario" || pathname.startsWith("/portal/calendario/"))
  ) {
    return true;
  }

  if (
    role === "comercial" &&
    (pathname === "/portal/contratos" || pathname.startsWith("/portal/contratos/"))
  ) {
    return false;
  }

  for (const base of PORTAL_ALWAYS_PATHS) {
    if (pathname === base || pathname.startsWith(`${base}/`)) return true;
  }

  if (!ent) return false;

  return portalPrefixAllowed(pathname, ent);
}

/** Destino inicial do portal consoante módulos activos. */
export function defaultPortalHome(ent: TenantEntitlements, role: JwtRole | null): string {
  if (role === "formando") {
    return ent.canAccessCoreFormation || ent.canAccessFormacaoTeams
      ? "/portal/formando"
      : "/acesso-negado";
  }
  if (role === "comercial") {
    return ent.canAccessCrm ? "/portal/crm/leads" : "/acesso-negado";
  }
  if (role === "coordenador_comercial") {
    return ent.canAccessCrm ? "/portal/crm" : "/acesso-negado";
  }
  if (role === "coordenador_financeiro") {
    return ent.canAccessFaturacao ? "/portal" : "/acesso-negado";
  }
  if (role === "coordenador_pedagogico") {
    return ent.canAccessCoreFormation || ent.canAccessFormacaoTeams
      ? "/portal"
      : "/acesso-negado";
  }
  if (ent.isModularSubscription) {
    if (ent.canAccessCrm) return "/portal/crm";
    if (ent.canAccessFaturacao) return "/portal/crm/faturas";
    if (ent.canAccessCoreFormation) return "/portal";
    if (ent.canAccessFormacaoTeams) return "/portal/acoes";
    if (ent.canAccessInteligenciaIa) return "/portal/relatorios";
    return "/portal/billing";
  }
  return "/portal";
}

export function navHrefAllowedByEntitlements(
  href: string,
  ent: TenantEntitlements | null | undefined,
): boolean {
  if (!ent) return false;
  if (href === "/portal") return true;
  if (href === "/portal/enterprise") return ent.canAccessEnterpriseFeatures;
  return isPortalPathAllowedByEntitlements(href, ent);
}
