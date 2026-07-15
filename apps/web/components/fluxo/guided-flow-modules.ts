import type { TenantEntitlements } from "@nexiforma/shared";
import type { JwtRole } from "@nexiforma/shared";

export type GuidedFlowId =
  | "setup-completo"
  | "acao-existente"
  | "sessao-existente"
  | "conteudos"
  | "dgert"
  | "crm"
  | "faturacao"
  | "relatorios"
  | "utilizadores"
  | "plugins"
  | "configuracoes";

export type GuidedFlowCategory = "formacao" | "negocio" | "admin";

export type GuidedFlowModule = {
  id: GuidedFlowId;
  title: string;
  description: string;
  category: GuidedFlowCategory;
  /** Vista interna no fluxo guiado */
  view?: "setup-completo" | "conteudos";
  /** Link directo (módulos de navegação) */
  href?: string;
  minRole?: JwtRole;
  visible: (ctx: {
    ent: TenantEntitlements;
    role: JwtRole | null;
    canManage: boolean;
  }) => boolean;
};

export const GUIDED_FLOW_MODULES: GuidedFlowModule[] = [
  {
    id: "setup-completo",
    title: "Nova formação completa",
    description: "Curso → acção → conteúdos LMS → sessão online (opcional), passo a passo.",
    category: "formacao",
    view: "setup-completo",
    minRole: "tenant_manager",
    visible: ({ ent, canManage }) => canManage && ent.canAccessCoreFormation,
  },
  {
    id: "acao-existente",
    title: "Acção num curso existente",
    description: "Cria uma nova acção formativa ligada a um curso do catálogo.",
    category: "formacao",
    href: "/portal/acoes",
    minRole: "tenant_manager",
    visible: ({ ent, canManage }) => canManage && ent.canAccessCoreFormation,
  },
  {
    id: "sessao-existente",
    title: "Sessão numa acção existente",
    description: "Cronograma, sessões, folha de presenças e sala Teams.",
    category: "formacao",
    href: "/portal/acoes",
    visible: ({ ent }) => ent.canAccessCoreFormation || ent.canAccessFormacaoTeams,
  },
  {
    id: "conteudos",
    title: "Conteúdos LMS",
    description: "Editor visual de módulos (vídeo, PDF, quiz, texto) num curso.",
    category: "formacao",
    view: "conteudos",
    visible: ({ ent }) => ent.canAccessCoreFormation,
  },
  {
    id: "dgert",
    title: "Qualidade & DGERT",
    description: "Compliance, dossiê pedagógico, certificados e exportação SIGO.",
    category: "formacao",
    href: "/portal/compliance",
    minRole: "tenant_manager",
    visible: ({ ent, canManage }) => canManage && ent.canAccessCoreFormation,
  },
  {
    id: "crm",
    title: "CRM comercial",
    description: "Leads, clientes, propostas e pipeline de vendas.",
    category: "negocio",
    href: "/portal/crm",
    visible: ({ ent }) => ent.canAccessCrm,
  },
  {
    id: "faturacao",
    title: "Faturação",
    description: "Faturas, séries AT e dados fiscais da entidade.",
    category: "negocio",
    href: "/portal/crm/faturas",
    minRole: "tenant_manager",
    visible: ({ ent, canManage }) => canManage && ent.canAccessFaturacao,
  },
  {
    id: "relatorios",
    title: "Relatórios",
    description: "Indicadores e exportações conforme os módulos activos.",
    category: "negocio",
    href: "/portal/relatorios",
    minRole: "tenant_manager",
    visible: ({ ent, canManage }) => canManage && ent.canAccessInteligenciaIa,
  },
  {
    id: "utilizadores",
    title: "Utilizadores",
    description: "Convites, papéis, MFA e gestão de acessos.",
    category: "admin",
    href: "/portal/utilizadores",
    minRole: "tenant_manager",
    visible: ({ canManage }) => canManage,
  },
  {
    id: "plugins",
    title: "Plugins",
    description: "Integrações Teams, Moodle e salas online.",
    category: "admin",
    href: "/portal/integracoes",
    minRole: "tenant_manager",
    visible: ({ ent, canManage }) =>
      canManage && (ent.canAccessFormacaoTeams || ent.canAccessCoreFormation),
  },
  {
    id: "configuracoes",
    title: "Configurações",
    description: "Dados da entidade, email e preferências do tenant.",
    category: "admin",
    href: "/portal/configuracoes",
    minRole: "tenant_manager",
    visible: ({ canManage }) => canManage,
  },
];

export const GUIDED_FLOW_CATEGORY_LABEL: Record<GuidedFlowCategory, string> = {
  formacao: "Formação",
  negocio: "Negócio",
  admin: "Administração",
};

export function visibleGuidedFlowModules(ctx: {
  ent: TenantEntitlements | null;
  role: JwtRole | null;
  canManage: boolean;
}): GuidedFlowModule[] {
  if (!ctx.ent) return [];
  return GUIDED_FLOW_MODULES.filter((m) => {
    if (m.minRole && ctx.role && ctx.role !== m.minRole && ctx.role !== "tenant_manager") {
      if (m.minRole === "tenant_manager" && !ctx.canManage) return false;
    }
    if (m.minRole === "tenant_manager" && !ctx.canManage) return false;
    return m.visible({ ent: ctx.ent!, role: ctx.role, canManage: ctx.canManage });
  });
}
