import type { JwtRole, TenantEntitlements } from "@nexiforma/shared";

/** Papéis de audiência do fluxo (coordenação pedagógica partilha «gestor»). */
export type GuidedFlowAudience = "gestor" | "comercial" | "formador" | "formando";

export type GuidedFlowCategory = "formacao" | "negocio" | "admin";

export type GuidedFlowStep = {
  title: string;
  description: string;
  /** Destino no portal para este passo (vista real). */
  href?: string;
  tip?: string;
  /** Pergunta enviada ao NexiGuia ao pedir ajuda neste passo. */
  helpPrompt?: string;
};

export type GuidedFlowInteractiveView = "setup-completo" | "conteudos";

export type GuidedFlowVisibleCtx = {
  ent: TenantEntitlements;
  role: JwtRole | null;
  canManage: boolean;
  canManageFormacao: boolean;
  canManageCrm: boolean;
  canManageFaturacao: boolean;
};

export type GuidedFlowModule = {
  id: string;
  title: string;
  description: string;
  category: GuidedFlowCategory;
  /** Quem pode ver este fluxo. */
  audiences: GuidedFlowAudience[];
  /** Wizard interactivo existente. */
  view?: GuidedFlowInteractiveView;
  /** Tutorial passo a passo. */
  steps?: GuidedFlowStep[];
  /** Atalho directo (sem tutorial). */
  href?: string;
  visible: (ctx: GuidedFlowVisibleCtx) => boolean;
};

export const GUIDED_FLOW_CATEGORY_LABEL: Record<GuidedFlowCategory, string> = {
  formacao: "Formação",
  negocio: "CRM e negócio",
  admin: "Administração",
};

export const GUIDED_FLOW_AUDIENCE_LABEL: Record<GuidedFlowAudience, string> = {
  gestor: "Gestão / coordenação",
  comercial: "Comercial",
  formador: "Formador",
  formando: "Formando",
};

export function audienceFromRole(role: JwtRole | null): GuidedFlowAudience | null {
  if (
    role === "tenant_manager" ||
    role === "coordenador_pedagogico"
  ) {
    return "gestor";
  }
  if (
    role === "comercial" ||
    role === "coordenador_comercial" ||
    role === "coordenador_financeiro"
  ) {
    return "comercial";
  }
  if (role === "formador") return "formador";
  if (role === "formando") return "formando";
  return null;
}

/** Comercial só vê negócio; formador/formando só formação; gestor vê tudo permitido. */
export function categoryAllowedForAudience(
  category: GuidedFlowCategory,
  audience: GuidedFlowAudience,
): boolean {
  if (audience === "comercial") return category === "negocio";
  if (audience === "formador" || audience === "formando") return category === "formacao";
  return true;
}
