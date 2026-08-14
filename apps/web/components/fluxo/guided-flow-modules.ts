import type { JwtRole, TenantEntitlements } from "@nexiforma/shared";
import { GUIDED_FLOW_CRM } from "./guided-flow-catalog-crm";
import { GUIDED_FLOW_FORMACAO } from "./guided-flow-catalog-formacao";
import {
  audienceFromRole,
  categoryAllowedForAudience,
  roleCanAccessGuidedFlowCategory,
  resolveGuidedFlowStep,
  resolveGuidedFlowSteps,
  GUIDED_FLOW_AUDIENCE_LABEL,
  GUIDED_FLOW_CATEGORY_LABEL,
  type GuidedFlowInteractiveView,
  type GuidedFlowModule,
} from "./guided-flow-types";

export type {
  GuidedFlowAudience,
  GuidedFlowCategory,
  GuidedFlowInteractiveView,
  GuidedFlowModule,
  GuidedFlowStep,
} from "./guided-flow-types";
export type GuidedFlowId = string;
export {
  GUIDED_FLOW_AUDIENCE_LABEL,
  GUIDED_FLOW_CATEGORY_LABEL,
  audienceFromRole,
  categoryAllowedForAudience,
  roleCanAccessGuidedFlowCategory,
  resolveGuidedFlowStep,
  resolveGuidedFlowSteps,
};

const GUIDED_FLOW_ADMIN: GuidedFlowModule[] = [
  {
    id: "utilizadores",
    title: "Utilizadores e convites",
    description: "Convites, papéis, MFA e gestão de acessos.",
    category: "admin",
    audiences: ["gestor"],
    visible: ({ canManage }) => canManage,
    steps: [
      {
        title: "Abrir utilizadores",
        description: "Vai a Administração → Utilizadores.",
        href: "/portal/utilizadores",
      },
      {
        title: "Convidar",
        description:
          "Convida por email com o cargo correcto (gestor, comercial, formador, formando).",
        tip: "Formadores e formandos precisam de NIF no convite.",
      },
      {
        title: "Confirmação de email",
        description:
          "Contas criadas com password pedem confirmação de email antes do primeiro login.",
      },
    ],
  },
  {
    id: "plugins",
    title: "Plugins e integrações",
    description: "Teams, Moodle e salas online.",
    category: "admin",
    audiences: ["gestor"],
    visible: ({ ent, canManage }) =>
      canManage && (ent.canAccessFormacaoTeams || ent.canAccessCoreFormation),
    href: "/portal/integracoes",
  },
  {
    id: "configuracoes",
    title: "Configurações da entidade",
    description: "Dados da entidade, email e preferências.",
    category: "admin",
    audiences: ["gestor"],
    visible: ({ canManage }) => canManage,
    href: "/portal/configuracoes",
  },
  {
    id: "relatorios",
    title: "Relatórios",
    description: "Indicadores e exportações (módulo Inteligência).",
    category: "admin",
    audiences: ["gestor"],
    visible: ({ ent, canManage }) => canManage && ent.canAccessInteligenciaIa,
    href: "/portal/relatorios",
  },
];

export const GUIDED_FLOW_MODULES: GuidedFlowModule[] = [
  ...GUIDED_FLOW_CRM,
  ...GUIDED_FLOW_FORMACAO,
  ...GUIDED_FLOW_ADMIN,
];

export function getGuidedFlowById(id: string): GuidedFlowModule | undefined {
  return GUIDED_FLOW_MODULES.find((m) => m.id === id);
}

export function moduleIdForInteractiveView(view: GuidedFlowInteractiveView): string {
  return view === "setup-completo" ? "setup-completo" : "formacao-conteudos-lms";
}

export function isGuidedFlowAllowed(
  moduleId: string,
  ctx: {
    ent: TenantEntitlements | null;
    role: JwtRole | null;
    canManage: boolean;
    canManageFormacao?: boolean;
    canManageCrm?: boolean;
    canManageFaturacao?: boolean;
  },
): boolean {
  if (!ctx.ent) return false;
  return visibleGuidedFlowModules({
    ent: ctx.ent,
    role: ctx.role,
    canManage: ctx.canManage,
    canManageFormacao: ctx.canManageFormacao,
    canManageCrm: ctx.canManageCrm,
    canManageFaturacao: ctx.canManageFaturacao,
  }).some((m) => m.id === moduleId);
}

export function visibleGuidedFlowModules(ctx: {
  ent: TenantEntitlements | null;
  role: JwtRole | null;
  canManage: boolean;
  canManageFormacao?: boolean;
  canManageCrm?: boolean;
  canManageFaturacao?: boolean;
}): GuidedFlowModule[] {
  if (!ctx.ent) return [];
  const audience = audienceFromRole(ctx.role);
  if (!audience) return [];

  const visibleCtx = {
    ent: ctx.ent,
    role: ctx.role,
    canManage: ctx.canManage,
    canManageFormacao: ctx.canManageFormacao ?? ctx.canManage,
    canManageCrm: ctx.canManageCrm ?? ctx.canManage,
    canManageFaturacao: ctx.canManageFaturacao ?? ctx.canManage,
  };

  return GUIDED_FLOW_MODULES.filter((m) => {
    if (!m.audiences.includes(audience)) return false;
    if (!categoryAllowedForAudience(m.category, audience)) return false;
    if (!roleCanAccessGuidedFlowCategory(ctx.role, m.category)) return false;
    return m.visible(visibleCtx);
  });
}

export function isInteractiveGuidedView(
  v: string | null | undefined,
): v is GuidedFlowInteractiveView {
  return v === "setup-completo" || v === "conteudos";
}
