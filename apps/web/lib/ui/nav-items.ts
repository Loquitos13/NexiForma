import type { JwtRole, TenantEntitlements } from "@nexiforma/shared";
import {
  BILLING_ADDON_LABELS,
  isComercial,
  isCoordenadorComercial,
  isCoordenadorFinanceiro,
  isCoordenadorPedagogico,
  isFormador,
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
  /** Oculta o item para estes papéis. */
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
  /** Módulo de subscrição - o grupo só aparece se o tenant tiver acesso. */
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

/** Mantém a 1.ª ocorrência de cada href (ex.: Calendário em Geral, não repetir no CRM). */
function dedupeNavGroupsByHref(groups: NavGroup[]): NavGroup[] {
  const seen = new Set<string>();
  return groups
    .map((g) => ({
      ...g,
      items: g.items.filter((item) => {
        if (seen.has(item.href)) return false;
        seen.add(item.href);
        return true;
      }),
    }))
    .filter((g) => g.items.length > 0);
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

  const privacyGroup: NavGroup = {
    label: "Conta",
    collapsible: false,
    items: [{ href: "/portal/rgpd", label: "RGPD", icon: "Lock" }],
  };
  const comunicacaoGroup = groups.find(
    (g) => g.label === "Comunicação" || g.label === "Comunicacao",
  );

  // Coordenador Comercial: Apenas departamento comercial (CRM) + RGPD + Notificações
  if (isCoordenadorComercial(role)) {
    const crmModule = groups.find((g) => g.module === "crm");
    if (!entitlements?.canAccessCrm || !crmModule) {
      return [privacyGroup].filter((g) => g.items.length > 0);
    }
    return dedupeNavGroupsByHref(
      [
        {
          ...crmModule,
          items: byEntitlements(crmModule.items),
        },
        comunicacaoGroup ? { ...comunicacaoGroup, items: byEntitlements(comunicacaoGroup.items) } : null,
        privacyGroup,
      ].filter((g): g is NavGroup => Boolean(g && g.items.length > 0)),
    );
  }

  // Agente Comercial: Apenas CRM básico + Fluxo + RGPD
  if (isComercial(role)) {
    const crmModule = groups.find((g) => g.module === "crm");
    const fluxo: NavGroup = {
      label: "Geral",
      collapsible: false,
      items: [{ href: "/portal/fluxo", label: "Fluxo guiado", icon: "Workflow" }],
    };
    const filteredFluxo = { ...fluxo, items: byEntitlements(fluxo.items) };
    const filteredPrivacy = { ...privacyGroup, items: byEntitlements(privacyGroup.items) };
    if (!entitlements?.canAccessCrm || !crmModule) {
      return [filteredFluxo, filteredPrivacy].filter((g) => g.items.length > 0);
    }
    return dedupeNavGroupsByHref(
      [
        filteredFluxo,
        {
          ...crmModule,
          items: byEntitlements(
            crmModule.items.filter((i) => i.minRole !== "tenant_manager" && i.minRole !== "coordenador_comercial"),
          ),
        },
        filteredPrivacy,
      ].filter((g): g is NavGroup => Boolean(g && g.items.length > 0)),
    );
  }

  // Coordenador Financeiro: Dashboard + Faturação (Faturação + Clientes) + Notificações + RGPD
  if (isCoordenadorFinanceiro(role)) {
    const geralModule = groups.find((g) => g.label === "Geral");
    const faturacaoModule = groups.find((g) => g.module === "faturacao");
    if (!entitlements?.canAccessFaturacao || !faturacaoModule) {
      return [
        geralModule ? { ...geralModule, items: byEntitlements(geralModule.items) } : null,
        privacyGroup,
      ].filter((g): g is NavGroup => Boolean(g && g.items.length > 0));
    }
    const enriched = enrichFaturacaoGroup(faturacaoModule, entitlements);
    return dedupeNavGroupsByHref(
      [
        geralModule ? { ...geralModule, items: byEntitlements(geralModule.items) } : null,
        {
          ...enriched,
          items: byEntitlements(enriched.items),
        },
        comunicacaoGroup ? { ...comunicacaoGroup, items: byEntitlements(comunicacaoGroup.items) } : null,
        privacyGroup,
      ].filter((g): g is NavGroup => Boolean(g && g.items.length > 0)),
    );
  }

  // Coordenador Pedagógico: Apenas Formação Core + Geral + RGPD + Notificações
  if (isCoordenadorPedagogico(role)) {
    const geralModule = groups.find((g) => g.label === "Geral");
    const formacaoModule = groups.find((g) => g.module === "formacao_core");
    const teamsModule = groups.find((g) => g.module === "formacao_teams");
    const activeFormacaoModule =
      formacaoModule && isNavModuleVisible(formacaoModule.module, entitlements)
        ? formacaoModule
        : teamsModule && isNavModuleVisible(teamsModule.module, entitlements)
          ? teamsModule
          : null;

    return dedupeNavGroupsByHref(
      [
        geralModule ? { ...geralModule, items: byEntitlements(geralModule.items) } : null,
        activeFormacaoModule
          ? {
              ...activeFormacaoModule,
              items: byEntitlements(activeFormacaoModule.items),
            }
          : null,
        comunicacaoGroup ? { ...comunicacaoGroup, items: byEntitlements(comunicacaoGroup.items) } : null,
        privacyGroup,
      ].filter((g): g is NavGroup => Boolean(g && g.items.length > 0)),
    );
  }

  // Formador: Apenas Formação (Cursos + Acções) + Geral + Comunicação + Conta (RGPD + O meu perfil)
  if (isFormador(role)) {
    const geralModule = groups.find((g) => g.label === "Geral");
    const formacaoModule = groups.find((g) => g.module === "formacao_core");
    const teamsModule = groups.find((g) => g.module === "formacao_teams");
    const activeFormacaoModule =
      formacaoModule && isNavModuleVisible(formacaoModule.module, entitlements)
        ? formacaoModule
        : teamsModule && isNavModuleVisible(teamsModule.module, entitlements)
          ? teamsModule
          : null;

    const formadorFormacaoItems = activeFormacaoModule
      ? activeFormacaoModule.items.filter(
          (i) => i.href === "/portal/cursos" || i.href === "/portal/acoes",
        )
      : [];

    const formadorContaGroup: NavGroup = {
      label: "Conta",
      collapsible: false,
      items: [
        { href: "/portal/rgpd", label: "RGPD", icon: "Lock" },
        { href: "/portal/formador/perfil", label: "O meu perfil", icon: "UserCheck" },
      ],
    };

    return dedupeNavGroupsByHref(
      [
        geralModule ? { ...geralModule, items: byEntitlements(geralModule.items) } : null,
        activeFormacaoModule && formadorFormacaoItems.length > 0
          ? {
              ...activeFormacaoModule,
              items: byEntitlements(formadorFormacaoItems),
            }
          : null,
        comunicacaoGroup ? { ...comunicacaoGroup, items: byEntitlements(comunicacaoGroup.items) } : null,
        formadorContaGroup,
      ].filter((g): g is NavGroup => Boolean(g && g.items.length > 0)),
    );
  }

  return dedupeNavGroupsByHref(
    applyModuleFilter(groups, entitlements)
      .filter((g) => !g.minRole || roleSatisfies(role, g.minRole))
      .map((g) => ({
        ...g,
        items: byEntitlements(g.items.filter((i) => !i.minRole || roleSatisfies(role, i.minRole))),
      }))
      .filter((g) => g.items.length > 0),
  );
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

  const path = (pathname.split("?")[0]?.split("#")[0] ?? pathname).replace(/\/$/, "") || "/";

  // Ecrã cheio do QR de presença (formador/gestor) - fora do menu, mas permitido.
  if (path.startsWith("/portal/formador/presenca-qr")) {
    return role === "formador" || role === "tenant_manager" || role === "coordenador_pedagogico";
  }

  if (entitlements && !isPortalPathAllowedByEntitlements(path, entitlements, role)) {
    return false;
  }

  if (isCoordenadorComercial(role) || isCoordenadorFinanceiro(role) || isCoordenadorPedagogico(role)) {
    // entitlements já aplicados; validar pelos hrefs do menu
    const allowed = allowedNavHrefs(role, entitlements);
    return (
      path.startsWith("/portal/demo/") ||
      allowed.some((href) => {
        if (href === "/portal") return path === "/portal";
        return path === href || path.startsWith(`${href}/`);
      })
    );
  }

  if (role === "tenant_manager") {
    if (!entitlements) return false;
    return isPortalPathAllowedByEntitlements(path, entitlements, role);
  }
  if (role === "comercial") {
    return (
      path.startsWith("/portal/demo/") ||
      isComercialCrmPortalPath(path) ||
      path.startsWith("/portal/rgpd") ||
      path === "/portal/fluxo" ||
      path.startsWith("/portal/fluxo/")
    );
  }
  if (role === "formando") {
    return (
      isFormandoPortalPath(path) ||
      path.startsWith("/portal/demo/") ||
      path.startsWith("/portal/suporte") ||
      path === "/portal/fluxo" ||
      path.startsWith("/portal/fluxo/")
    );
  }
  if (path.startsWith("/portal/demo/")) return true;

  const allowed = allowedNavHrefs(role, entitlements);
  return allowed.some((href) => {
    if (href === "/portal") return path === "/portal";
    return path === href || path.startsWith(`${href}/`);
  });
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Geral",
    collapsible: false,
    items: [
      { href: "/portal", label: "Dashboard", icon: "LayoutDashboard" },
      { href: "/portal/fluxo", label: "Fluxo guiado", icon: "Workflow" },
      { href: "/portal/calendario", label: "Calendário", icon: "Calendar" },
      { href: "/portal/suporte", label: "Suporte", icon: "LifeBuoy" },
    ],
  },
  {
    label: "CRM",
    module: "crm",
    moduleLabel: BILLING_ADDON_LABELS.crm,
    icon: "PieChart",
    items: [
      { href: "/portal/crm", label: "Dashboard", icon: "PieChart", minRole: "coordenador_comercial" },
      { href: "/portal/crm/leads", label: "Leads", icon: "UserPlus" },
      { href: "/portal/crm/interaccoes", label: "Notas comerciais", icon: "MessageSquare" },
      { href: "/portal/calendario", label: "Calendário", icon: "Calendar" },
      { href: "/portal/crm/sugestoes-ia", label: "Sugestões IA", icon: "Sparkles" },
      { href: "/portal/clientes", label: "Clientes", icon: "Building2" },
      { href: "/portal/parceiros", label: "Parceiros", icon: "Handshake" },
      { href: "/portal/propostas", label: "Propostas", icon: "FileText" },
      { href: "/portal/contratos", label: "Contratos", icon: "FileCheck", minRole: "coordenador_comercial" },
    ],
    minRole: "coordenador_comercial",
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
    minRole: "coordenador_financeiro",
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
    label: "Comunicação",
    moduleLabel: "Comunicação",
    collapsible: true,
    icon: "Bell",
    items: [{ href: "/portal/notificacoes", label: "Centro de avisos", icon: "Bell" }],
  },
  {
    label: "Formação",
    module: "formacao_core",
    moduleLabel: BILLING_ADDON_LABELS.formacao_core,
    icon: "GraduationCap",
    minRole: "coordenador_pedagogico",
    items: [
      { href: "/portal/cursos", label: "Cursos", icon: "BookOpen" },
      { href: "/portal/formacoes", label: "Formações website", icon: "Globe", minRole: "coordenador_pedagogico" },
      { href: "/portal/acoes", label: "Acções", icon: "GraduationCap" },
      { href: "/portal/catalogo-ufcd", label: "Catálogo UFCD", icon: "Library" },
      { href: "/portal/matriculas", label: "Inscrições", icon: "UserPlus", minRole: "coordenador_pedagogico" },
      { href: "/portal/formandos", label: "Formandos", icon: "Users", minRole: "coordenador_pedagogico" },
      {
        href: "/portal/formandos/registo-cliente",
        label: "Clientes",
        icon: "Building2",
        minRole: "coordenador_pedagogico",
      },
      { href: "/portal/avaliacoes", label: "Avaliações", icon: "BarChart3", minRole: "coordenador_pedagogico" },
      { href: "/portal/formadores", label: "Formadores", icon: "UserCheck", minRole: "coordenador_pedagogico" },
      { href: "/portal/compliance", label: "Compliance DGERT", icon: "ShieldCheck", minRole: "coordenador_pedagogico" },
      { href: "/portal/dossie", label: "Dossiê & Exports", icon: "FolderOpen", minRole: "coordenador_pedagogico" },
      { href: "/portal/certificados", label: "Certificados", icon: "Award", minRole: "coordenador_pedagogico" },
      { href: "/portal/sigo", label: "SIGO", icon: "Upload", minRole: "coordenador_pedagogico" },
      { href: "/portal/integracoes", label: "Plugins", icon: "Plug", minRole: "coordenador_pedagogico" },
    ],
  },
  {
    label: "Formação Teams",
    module: "formacao_teams",
    moduleLabel: BILLING_ADDON_LABELS.formacao_teams,
    icon: "Video",
    minRole: "coordenador_pedagogico",
    items: [
      { href: "/portal/acoes", label: "Acções", icon: "GraduationCap" },
      { href: "/portal/calendario", label: "Calendário", icon: "Calendar" },
      { href: "/portal/integracoes", label: "Plugins", icon: "Plug", minRole: "coordenador_pedagogico" },
    ],
  },
  {
    label: "Administração",
    collapsible: true,
    icon: "Shield",
    items: [
      { href: "/portal/utilizadores", label: "Utilizadores", icon: "UserCog" },
      { href: "/portal/configuracoes", label: "Configurações", icon: "Settings" },
      { href: "/portal/billing", label: "Subscrição", icon: "CreditCard" },
      { href: "/portal/enterprise", label: "Enterprise", icon: "Building2" },
      { href: "/portal/compliance", label: "Auditoria & DGERT", icon: "ShieldAlert" },
      { href: "/portal/sigo", label: "SIGO & SAF-T", icon: "BookOpen" },
      { href: "/portal/integracoes", label: "Plugins", icon: "Plug", minRole: "coordenador_pedagogico" },
    ],
  },
  {
    label: "Conta",
    collapsible: false,
    items: [
      { href: "/portal/rgpd", label: "RGPD", icon: "Lock" },
    ],
  },
];

export const NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

/** Hrefs que no mobile vivem no menu do avatar (não na bottom nav). */
const MOBILE_AVATAR_NAV_HREFS = new Set(["/portal/notificacoes", "/portal/rgpd"]);

/** Grupos para a bottom nav mobile - sem notificações/RGPD (vão para o avatar). */
export function filterGroupsForMobileBottomNav(
  groups: NavGroup[],
  role: JwtRole | null | undefined,
  entitlements?: TenantEntitlements | null,
): NavGroup[] {
  return filterGroups(groups, role ?? null, entitlements)
    .map((g) => ({
      ...g,
      items: g.items.filter((item) => !MOBILE_AVATAR_NAV_HREFS.has(item.href)),
    }))
    .filter((g) => g.items.length > 0);
}

export type PortalBreadcrumb = { group: string; item: string };

/** Rótulos curtos para breadcrumbs mobile (ex. «CRM > Dashboard»). */
const BREADCRUMB_GROUP_SHORT: Record<string, string> = {
  Geral: "Geral",
  CRM: "CRM",
  "CRM Comercial": "CRM",
  Faturação: "Faturação",
  "Faturação AT": "Faturação",
  Inteligência: "IA",
  "Inteligência & IA": "IA",
  Comunicação: "Avisos",
  Comunicacao: "Avisos",
  Formação: "Formação",
  "Formação Core": "Formação",
  "Formação Teams": "Teams",
  Administração: "Admin",
  Conta: "Conta",
};

function shortBreadcrumbGroup(title: string): string {
  return BREADCRUMB_GROUP_SHORT[title] ?? title;
}

/** Resolve "Grupo > Item" a partir do pathname actual. */
export function resolvePortalBreadcrumb(
  pathname: string,
  role: JwtRole | null | undefined,
  entitlements?: TenantEntitlements | null,
): PortalBreadcrumb | null {
  const groups = filterGroups(NAV_GROUPS, role ?? null, entitlements);
  let best: { group: string; item: string; len: number } | null = null;

  for (const group of groups) {
    for (const item of group.items) {
      const match =
        item.href === "/portal"
          ? pathname === "/portal"
          : pathname === item.href || pathname.startsWith(`${item.href}/`);
      if (!match) continue;
      const len = item.href.length;
      if (!best || len > best.len) {
        const groupTitle = navGroupTitle(group);
        let cleanItem = item.label;
        // Evita repetição ex: "CRM > CRM Dashboard" -> "CRM > Dashboard"
        if (cleanItem.toLowerCase().startsWith(`${groupTitle.toLowerCase()} `)) {
          cleanItem = cleanItem.slice(groupTitle.length).trim();
        } else if (groupTitle.toLowerCase().includes("crm") && cleanItem.toLowerCase().startsWith("crm ")) {
          cleanItem = cleanItem.slice(4).trim();
        }
        best = { group: shortBreadcrumbGroup(groupTitle), item: cleanItem, len };
      }
    }
  }

  return best ? { group: best.group, item: best.item } : null;
}
