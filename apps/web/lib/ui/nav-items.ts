import type { JwtRole, TenantEntitlements } from "@nexiforma/shared";
import {
  BILLING_ADDON_LABELS,
  isComercial,
  isFormandoPortalPath,
  isPortalPathAllowedByEntitlements,
  navHrefAllowedByEntitlements,
  PORTAL_ALWAYS_PATHS,
  roleSatisfies,
  isComercialCrmPortalPath,
} from "@nexiforma/shared";

export interface NavItem {
  href: string;
  label: string;
  icon?: string;
  minRole?: JwtRole;
  /** Oculta o item para estes papéis (ex.: formador sem página LMS global). */
  excludeRoles?: JwtRole[];
}

/** Módulos de subscrição reflectidos na sidebar colapsável. */
export type NavModuleId =
  | "crm"
  | "faturacao"
  | "formacao_core"
  | "formacao_teams"
  | "inteligencia_ia";

export interface NavGroup {
  label: string;
  items: NavItem[];
  minRole?: JwtRole;
  /** Módulo de subscrição — o grupo só aparece se o tenant tiver acesso. */
  module?: NavModuleId;
  /** Nome comercial na sidebar (ex. «CRM Comercial»). */
  moduleLabel?: string;
  /** Ícone do botão colapsável do módulo. */
  icon?: string;
  /** Secção colapsável. Por defeito: true quando `module` está definido. */
  collapsible?: boolean;
}

function isAlwaysAllowedNavHref(href: string): boolean {
  for (const base of PORTAL_ALWAYS_PATHS) {
    if (href === base || href.startsWith(`${base}/`)) return true;
  }
  return false;
}

/** O tenant tem o módulo activo para mostrar o grupo na sidebar. */
export function isNavModuleVisible(
  module: NavModuleId | undefined,
  ent: TenantEntitlements | null | undefined,
): boolean {
  if (!module) return true;
  if (!ent) return false;
  switch (module) {
    case "crm":
      return ent.canAccessCrm;
    case "faturacao":
      return ent.canAccessFaturacao;
    case "formacao_core":
      return ent.canAccessCoreFormation;
    case "formacao_teams":
      return ent.canAccessFormacaoTeams && !ent.canAccessCoreFormation;
    case "inteligencia_ia":
      return ent.canAccessRelatoriosDashboard;
    default:
      return true;
  }
}

export function isNavGroupCollapsible(group: NavGroup): boolean {
  if (group.collapsible === false) return false;
  if (group.collapsible === true) return true;
  return Boolean(group.module);
}

export function navGroupTitle(group: NavGroup): string {
  return group.moduleLabel ?? group.label;
}

function enrichFaturacaoGroup(group: NavGroup, ent: TenantEntitlements | null | undefined): NavGroup {
  if (group.module !== "faturacao" || !ent || ent.canAccessCrm) return group;
  const hasClientes = group.items.some((i) => i.href === "/portal/clientes");
  if (hasClientes) return group;
  return {
    ...group,
    items: [
      ...group.items,
      { href: "/portal/clientes", label: "Clientes", icon: "Building2" },
    ],
  };
}

function applyModuleFilter(
  groups: NavGroup[],
  entitlements?: TenantEntitlements | null,
): NavGroup[] {
  return groups
    .filter((g) => isNavModuleVisible(g.module, entitlements))
    .map((g) => enrichFaturacaoGroup(g, entitlements));
}

export function filterGroups(
  groups: NavGroup[],
  role: JwtRole | null,
  entitlements?: TenantEntitlements | null,
): NavGroup[] {
  const byEntitlements = (items: NavItem[]) => {
    const byRole = items.filter((i) => !i.excludeRoles?.includes(role as JwtRole));
    if (!entitlements) {
      return byRole.filter((i) => isAlwaysAllowedNavHref(i.href));
    }
    return byRole.filter((i) => navHrefAllowedByEntitlements(i.href, entitlements));
  };

  if (isComercial(role)) {
    const crmModule = groups.find((g) => g.module === "crm");
    const geral: NavGroup = {
      label: "Geral",
      collapsible: false,
      items: [
        { href: "/portal/crm", label: "CRM Dashboard", icon: "PieChart" },
        { href: "/portal/calendario", label: "Calendário", icon: "Calendar" },
      ],
    };
    const privacy: NavGroup = {
      label: "Conta",
      collapsible: false,
      items: [{ href: "/portal/rgpd", label: "RGPD", icon: "Lock" }],
    };
    const filteredPrivacy = { ...privacy, items: byEntitlements(privacy.items) };
    if (!entitlements?.canAccessCrm) {
      return filteredPrivacy.items.length ? [filteredPrivacy] : [];
    }
    return [
      { ...geral, items: byEntitlements(geral.items) },
      crmModule
        ? {
            ...crmModule,
            items: byEntitlements(
              crmModule.items.filter((i) => i.minRole !== "tenant_manager"),
            ),
          }
        : null,
      filteredPrivacy,
    ]
      .filter((g): g is NavGroup => Boolean(g && g.items.length > 0));
  }

  return applyModuleFilter(groups, entitlements)
    .filter((g) => !g.minRole || roleSatisfies(role, g.minRole))
    .map((g) => ({
      ...g,
      items: byEntitlements(g.items.filter((i) => !i.minRole || roleSatisfies(role, i.minRole))),
    }))
    .filter((g) => g.items.length > 0);
}

/** Hrefs visíveis na sidebar para o papel (inclui sub-rotas, ex. /portal/acoes/[id]). */
export function allowedNavHrefs(
  role: JwtRole | null,
  entitlements?: TenantEntitlements | null,
): string[] {
  return filterGroups(NAV_GROUPS, role, entitlements).flatMap((g) => g.items.map((i) => i.href));
}

export function isPortalPathAllowed(
  role: JwtRole | null,
  pathname: string,
  entitlements?: TenantEntitlements | null,
): boolean {
  if (!role) return false;
  if (role === "super_admin") return false;

  if (entitlements && !isPortalPathAllowedByEntitlements(pathname, entitlements)) {
    return false;
  }

  if (role === "tenant_manager") {
    return entitlements
      ? isPortalPathAllowedByEntitlements(pathname, entitlements)
      : true;
  }
  if (role === "comercial") {
    return (
      pathname.startsWith("/portal/demo/") ||
      pathname.startsWith("/portal/calendario") ||
      isComercialCrmPortalPath(pathname) ||
      pathname.startsWith("/portal/rgpd")
    );
  }
  if (role === "formando") {
    return (
      isFormandoPortalPath(pathname) ||
      pathname.startsWith("/portal/demo/") ||
      pathname.startsWith("/portal/suporte")
    );
  }
  if (pathname.startsWith("/portal/demo/")) return true;

  const allowed = allowedNavHrefs(role, entitlements);
  return allowed.some((href) => {
    if (href === "/portal") return pathname === "/portal" || pathname === "/portal/";
    return pathname === href || pathname.startsWith(`${href}/`);
  });
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Geral",
    collapsible: false,
    items: [
      { href: "/portal", label: "Dashboard", icon: "LayoutDashboard" },
      { href: "/portal/fluxo", label: "Fluxo guiado", icon: "Workflow", minRole: "tenant_manager" },
      { href: "/portal/calendario", label: "Calendario", icon: "Calendar" },
      { href: "/portal/suporte", label: "Suporte", icon: "LifeBuoy" },
    ],
  },
  {
    label: "CRM",
    module: "crm",
    moduleLabel: BILLING_ADDON_LABELS.crm,
    icon: "PieChart",
    items: [
      { href: "/portal/crm", label: "CRM Dashboard", icon: "PieChart" },
      { href: "/portal/crm/leads", label: "Leads", icon: "UserPlus" },
      { href: "/portal/crm/interaccoes", label: "Notas comerciais", icon: "MessageSquare" },
      { href: "/portal/crm/sugestoes-ia", label: "Sugestões IA", icon: "Sparkles" },
      { href: "/portal/clientes", label: "Clientes", icon: "Building2" },
      { href: "/portal/parceiros", label: "Parceiros", icon: "Handshake" },
      { href: "/portal/propostas", label: "Propostas", icon: "FileText" },
      { href: "/portal/propostas/config", label: "Modelo propostas", icon: "Settings", minRole: "tenant_manager" },
      { href: "/portal/contratos", label: "Contratos", icon: "FileCheck" },
    ],
    minRole: "tenant_manager",
  },
  {
    label: "Faturação",
    module: "faturacao",
    moduleLabel: BILLING_ADDON_LABELS.faturacao_at,
    icon: "Receipt",
    items: [
      { href: "/portal/crm/faturas", label: "Faturas", icon: "Receipt" },
      { href: "/portal/crm/faturacao", label: "Dados faturação", icon: "Settings" },
    ],
    minRole: "tenant_manager",
  },
  {
    label: "Inteligência",
    module: "inteligencia_ia",
    moduleLabel: BILLING_ADDON_LABELS.inteligencia_ia,
    icon: "BarChart3",
    items: [
      { href: "/portal/relatorios", label: "Relatorios", icon: "BarChart3", minRole: "tenant_manager" },
    ],
    minRole: "tenant_manager",
  },
  {
    label: "Comunicacao",
    collapsible: true,
    icon: "Bell",
    items: [{ href: "/portal/notificacoes", label: "Notificacoes", icon: "Bell" }],
    minRole: "tenant_manager",
  },
  {
    label: "Formacao",
    module: "formacao_core",
    moduleLabel: BILLING_ADDON_LABELS.formacao_core,
    icon: "GraduationCap",
    items: [
      { href: "/portal/cursos", label: "Cursos", icon: "BookOpen" },
      { href: "/portal/formacoes", label: "Formacoes website", icon: "Globe", minRole: "tenant_manager" },
      { href: "/portal/acoes", label: "Accoes", icon: "GraduationCap" },
      { href: "/portal/catalogo-ufcd", label: "Catalogo UFCD", icon: "Library" },
      { href: "/portal/matriculas", label: "Inscricoes", icon: "UserPlus", minRole: "tenant_manager" },
      { href: "/portal/formandos", label: "Formandos", icon: "Users", minRole: "tenant_manager" },
      { href: "/portal/formadores", label: "Formadores", icon: "UserCheck", minRole: "tenant_manager" },
      { href: "/portal/avaliacoes", label: "Avaliacoes", icon: "ClipboardCheck", minRole: "tenant_manager" },
      { href: "/portal/lms", label: "LMS & Assiduidade", icon: "Monitor", excludeRoles: ["formador"], minRole: "tenant_manager" },
      { href: "/portal/conteudos", label: "Conteudos LMS", icon: "Package" },
      { href: "/portal/documentos", label: "Documentos", icon: "FolderOpen", minRole: "tenant_manager" },
      { href: "/portal/compliance", label: "Compliance DGERT", icon: "ShieldCheck", minRole: "tenant_manager" },
      { href: "/portal/dossie", label: "Dossie & Exports", icon: "FolderOpen", minRole: "tenant_manager" },
      { href: "/portal/certificados", label: "Certificados", icon: "Award", minRole: "tenant_manager" },
      { href: "/portal/sigo", label: "SIGO", icon: "Upload", minRole: "tenant_manager" },
      { href: "/portal/integracoes", label: "Plugins", icon: "Plug", minRole: "tenant_manager" },
    ],
  },
  {
    label: "Formação Teams",
    module: "formacao_teams",
    moduleLabel: BILLING_ADDON_LABELS.formacao_teams,
    icon: "Video",
    items: [
      { href: "/portal/acoes", label: "Accoes", icon: "GraduationCap" },
      { href: "/portal/calendario", label: "Calendario", icon: "Calendar" },
      { href: "/portal/lms", label: "LMS & Assiduidade", icon: "Monitor", excludeRoles: ["formador"], minRole: "tenant_manager" },
      { href: "/portal/integracoes", label: "Plugins", icon: "Plug", minRole: "tenant_manager" },
    ],
  },
  {
    label: "Conta",
    collapsible: false,
    items: [{ href: "/portal/rgpd", label: "RGPD", icon: "Lock" }],
  },
  {
    label: "Administracao",
    collapsible: true,
    icon: "Settings",
    items: [
      { href: "/portal/configuracoes", label: "Configuracoes", icon: "Settings" },
      { href: "/portal/utilizadores", label: "Utilizadores", icon: "UserCog" },
      { href: "/portal/integracoes", label: "Plugins", icon: "Plug" },
      { href: "/portal/enterprise", label: "Enterprise", icon: "Key" },
      { href: "/portal/billing", label: "Subscricao", icon: "CreditCard" },
    ],
    minRole: "tenant_manager",
  },
];

export const NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);
