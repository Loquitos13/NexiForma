import type { JwtRole } from "@nexiforma/shared";
import { isComercial, roleSatisfies } from "@nexiforma/shared";

export interface NavItem {
  href: string;
  label: string;
  icon?: string;
  minRole?: JwtRole;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
  minRole?: JwtRole;
}

export function filterGroups(groups: NavGroup[], role: JwtRole | null): NavGroup[] {
  if (isComercial(role)) {
    const crm = groups.find((g) => g.label === "CRM");
    const privacy: NavGroup = {
      label: "Conta",
      items: [{ href: "/portal/rgpd", label: "RGPD", icon: "Lock" }],
    };
    return crm ? [{ ...crm, items: [...crm.items] }, privacy] : [privacy];
  }
  return groups
    .filter((g) => !g.minRole || roleSatisfies(role, g.minRole))
    .map((g) => ({
      ...g,
      items: g.items.filter((i) => !i.minRole || roleSatisfies(role, i.minRole)),
    }))
    .filter((g) => g.items.length > 0);
}

/** Hrefs visíveis na sidebar para o papel (inclui sub-rotas, ex. /portal/acoes/[id]). */
export function allowedNavHrefs(role: JwtRole | null): string[] {
  return filterGroups(NAV_GROUPS, role).flatMap((g) => g.items.map((i) => i.href));
}

export function isPortalPathAllowed(role: JwtRole | null, pathname: string): boolean {
  if (!role) return false;
  if (role === "tenant_manager") return true;
  if (role === "super_admin") return false;
  if (role === "comercial") {
    return pathname.startsWith("/portal/demo/") || isCrmPortalPath(pathname) || pathname.startsWith("/portal/rgpd");
  }
  if (role === "formando") {
    return pathname.startsWith("/portal/formando") || pathname.startsWith("/portal/demo/");
  }
  if (pathname.startsWith("/portal/demo/")) return true;

  const allowed = allowedNavHrefs(role);
  return allowed.some((href) => pathname === href || pathname.startsWith(`${href}/`));
}

function isCrmPortalPath(pathname: string): boolean {
  const crm = NAV_GROUPS.find((g) => g.label === "CRM");
  if (!crm) return false;
  return crm.items.some(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Geral",
    items: [
      { href: "/portal", label: "Dashboard", icon: "LayoutDashboard" },
      { href: "/portal/fluxo", label: "Fluxo guiado", icon: "Workflow", minRole: "tenant_manager" },
      { href: "/portal/calendario", label: "Calendario", icon: "Calendar", minRole: "tenant_manager" },
      { href: "/portal/relatorios", label: "Relatorios", icon: "BarChart3", minRole: "tenant_manager" },
    ],
  },
  {
    label: "CRM",
    items: [
      { href: "/portal/crm", label: "CRM Dashboard", icon: "PieChart" },
      { href: "/portal/crm/leads", label: "Leads", icon: "UserPlus" },
      { href: "/portal/clientes", label: "Clientes", icon: "Building2" },
      { href: "/portal/parceiros", label: "Parceiros", icon: "Handshake" },
      { href: "/portal/propostas", label: "Propostas", icon: "FileText" },
      { href: "/portal/propostas/config", label: "Modelo propostas", icon: "Settings", minRole: "tenant_manager" },
      { href: "/portal/crm/faturas", label: "Faturas", icon: "Receipt" },
      { href: "/portal/crm/faturacao", label: "Dados faturação", icon: "Settings", minRole: "tenant_manager" },
      { href: "/portal/formacoes", label: "Formacoes website", icon: "Globe", minRole: "tenant_manager" },
      { href: "/portal/contratos", label: "Contratos", icon: "FileCheck" },
    ],
    minRole: "tenant_manager",
  },
  {
    label: "Comunicacao",
    items: [
      { href: "/portal/notificacoes", label: "Notificacoes", icon: "Bell" },
    ],
    minRole: "tenant_manager",
  },
  {
    label: "Formacao",
    items: [
      { href: "/portal/cursos", label: "Cursos", icon: "BookOpen" },
      { href: "/portal/formacoes", label: "Formacoes website", icon: "Globe", minRole: "tenant_manager" },
      { href: "/portal/acoes", label: "Accoes", icon: "GraduationCap" },
      { href: "/portal/catalogo-ufcd", label: "Catalogo UFCD", icon: "Library" },
      { href: "/portal/matriculas", label: "Inscricoes", icon: "UserPlus", minRole: "tenant_manager" },
      { href: "/portal/formandos", label: "Formandos", icon: "Users", minRole: "tenant_manager" },
      { href: "/portal/formadores", label: "Formadores", icon: "UserCheck", minRole: "tenant_manager" },
      { href: "/portal/avaliacoes", label: "Avaliacoes", icon: "ClipboardCheck", minRole: "tenant_manager" },
    ],
  },
  {
    label: "Operacional",
    items: [
      { href: "/portal/lms", label: "LMS & Assiduidade", icon: "Monitor" },
      { href: "/portal/conteudos", label: "Conteudos LMS", icon: "Package" },
      { href: "/portal/documentos", label: "Documentos", icon: "FolderOpen", minRole: "tenant_manager" },
    ],
  },
  {
    label: "Qualidade / DGERT",
    minRole: "tenant_manager",
    items: [
      { href: "/portal/compliance", label: "Compliance DGERT", icon: "ShieldCheck" },
      { href: "/portal/dossie", label: "Dossie & Exports", icon: "FolderOpen" },
      { href: "/portal/certificados", label: "Certificados", icon: "Award" },
      { href: "/portal/sigo", label: "SIGO", icon: "Upload" },
      { href: "/portal/rgpd", label: "RGPD", icon: "Lock" },
    ],
  },
  {
    label: "Administracao",
    items: [
      { href: "/portal/configuracoes", label: "Configuracoes", icon: "Settings" },
      { href: "/portal/utilizadores", label: "Utilizadores", icon: "UserCog" },
      { href: "/portal/integracoes", label: "Integracoes", icon: "Plug" },
      { href: "/portal/enterprise", label: "Enterprise", icon: "Key" },
      { href: "/portal/billing", label: "Subscricao", icon: "CreditCard" },
    ],
    minRole: "tenant_manager",
  },
];

export const NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);
