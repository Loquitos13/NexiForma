import type { JwtRole, TenantEntitlements } from "@nexiforma/shared";

/** Papéis de audiência do fluxo (coordenação pedagógica partilha «gestor»). */
export type GuidedFlowAudience = "gestor" | "comercial" | "formador" | "formando";

export type GuidedFlowCategory = "formacao" | "negocio" | "admin";

export type GuidedFlowStep = {
  title: string;
  description: string;
  /** Destino no portal para este passo (vista real). */
  href?: string;
  /**
   * Rotas filhas contam como cumpridas (ex.: `/portal/acoes/[id]` para href `/portal/acoes`).
   * Usado na UI e no auto-avanço.
   */
  hrefPrefix?: boolean;
  /**
   * Avançar automaticamente quando o objectivo do passo estiver cumprido
   * (ex.: abrir ficha da acção, mudar separador).
   */
  autoAdvance?: boolean;
  /**
   * Só considera cumprido com segmento filho (ficha `/portal/acoes/[id]`, não a lista).
   * Por defeito igual a `hrefPrefix` quando `autoAdvance` está activo.
   */
  autoAdvanceRequiresChildPath?: boolean;
  /**
   * Elemento alvo na vista real (`data-guided-flow-anchor`).
   * Só mostra apontador quando um fluxo guiado está activo neste passo.
   */
  anchor?: string;
  /**
   * Rota mínima para mostrar o spotlight (por defeito usa `href`).
   * Útil quando o passo só se cumpre num separador mas o alvo aparece antes.
   */
  anchorHref?: string;
  tip?: string;
  /** Pergunta enviada ao NexiGuia ao pedir ajuda neste passo. */
  helpPrompt?: string;
  /** Substitui campos consoante o papel JWT (ex.: comercial sem CRM Dashboard). */
  roleVariants?: Partial<
    Record<
      JwtRole,
      Partial<Pick<GuidedFlowStep, "title" | "description" | "href" | "tip" | "anchor" | "anchorHref" | "helpPrompt" | "hrefPrefix" | "autoAdvance" | "autoAdvanceRequiresChildPath">>
    >
  >;
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

/** Restrições por papel JWT (além de audiência + entitlements). */
export function roleCanAccessGuidedFlowCategory(
  role: JwtRole | null,
  category: GuidedFlowCategory,
): boolean {
  if (!role) return false;
  const audience = audienceFromRole(role);
  if (!audience || !categoryAllowedForAudience(category, audience)) return false;

  if (role === "coordenador_pedagogico") return category === "formacao";
  if (role === "coordenador_comercial" || role === "comercial") return category === "negocio";
  if (role === "coordenador_financeiro") return category === "negocio";
  if (role === "formador" || role === "formando") return category === "formacao";

  return true;
}

export function resolveGuidedFlowStep(
  step: GuidedFlowStep,
  role: JwtRole | null,
): GuidedFlowStep {
  if (!role || !step.roleVariants?.[role]) return step;
  const variant = step.roleVariants[role]!;
  return { ...step, ...variant };
}

export function resolveGuidedFlowSteps(
  steps: GuidedFlowStep[] | undefined,
  role: JwtRole | null,
): GuidedFlowStep[] {
  return (steps ?? []).map((step) => resolveGuidedFlowStep(step, role));
}
