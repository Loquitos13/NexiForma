import type { BillingAddonCode, BillingPlanCode } from "./plans-catalog";
import { MODULAR_PLAN_CODE } from "./plans-catalog";

/** Pacote legado (subscrições existentes): activa CRM + Faturação AT. */
export const LEGACY_CRM_FATURACAO_BUNDLE: BillingAddonCode = "crm_faturacao";

export type ResolvedModuleFlags = {
  hasCrm: boolean;
  hasFaturacao: boolean;
  hasFormacaoCore: boolean;
  hasFormacaoTeams: boolean;
  hasInteligenciaIa: boolean;
};

export function resolveModuleFlags(
  activeAddons: readonly BillingAddonCode[],
  planCode: BillingPlanCode,
): ResolvedModuleFlags {
  const has = (code: BillingAddonCode) => activeAddons.includes(code);
  const legacyBundle = has(LEGACY_CRM_FATURACAO_BUNDLE);
  const isModular = planCode === MODULAR_PLAN_CODE;

  return {
    hasCrm: has("crm") || legacyBundle,
    hasFaturacao: has("faturacao_at") || legacyBundle,
    hasFormacaoCore: !isModular || has("formacao_core"),
    hasFormacaoTeams: has("formacao_teams"),
    hasInteligenciaIa: has("inteligencia_ia"),
  };
}
