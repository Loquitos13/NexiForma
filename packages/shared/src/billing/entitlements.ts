import {
  BILLING_ADDON_CODES,
  type BillingAddonCode,
  type BillingPlanCode,
  PLAN_NATIVE_ADDONS,
  PLAN_NEGOTIABLE_ADDONS,
  PLAN_RELATORIOS_TIER,
  type RelatoriosTier,
} from "./plans-catalog";

export type TenantEntitlements = {
  planCode: BillingPlanCode;
  customAddons: BillingAddonCode[];
  activeAddons: BillingAddonCode[];
  relatoriosTier: RelatoriosTier;
  canAccessCrm: boolean;
  canAccessFaturacao: boolean;
  canAccessFormacaoTeams: boolean;
  canAccessInteligenciaIa: boolean;
  canAccessRelatoriosDashboard: boolean;
  canAccessRelatoriosInsights: boolean;
  canUpgradeAnytime: boolean;
  allowsCustomAddons: boolean;
};

function parseAddonList(raw: unknown): BillingAddonCode[] {
  if (!Array.isArray(raw)) return [];
  const allowed = new Set<string>(BILLING_ADDON_CODES);
  return raw.filter((v): v is BillingAddonCode => typeof v === "string" && allowed.has(v));
}

function normalizePlanCode(code: string | null | undefined): BillingPlanCode {
  if (code === "pro" || code === "enterprise") return code;
  return "starter";
}

/** Resolve entitlements efectivos: plano base + add-ons nativos + add-ons negociados. */
export function resolveTenantEntitlements(
  planCodeInput: string | null | undefined,
  customAddonsInput: unknown,
): TenantEntitlements {
  const planCode = normalizePlanCode(planCodeInput);
  const customAddons = parseAddonList(customAddonsInput);
  const negotiable = new Set(PLAN_NEGOTIABLE_ADDONS[planCode]);
  const validCustom = customAddons.filter((a) => negotiable.has(a));
  const native = PLAN_NATIVE_ADDONS[planCode];
  const activeAddons = [...new Set([...native, ...validCustom])];
  const has = (code: BillingAddonCode) => activeAddons.includes(code);
  const relatoriosTier = PLAN_RELATORIOS_TIER[planCode];

  return {
    planCode,
    customAddons: validCustom,
    activeAddons,
    relatoriosTier,
    canAccessCrm: has("crm_faturacao"),
    canAccessFaturacao: has("crm_faturacao"),
    canAccessFormacaoTeams: has("formacao_teams"),
    canAccessInteligenciaIa: has("inteligencia_ia"),
    canAccessRelatoriosDashboard: relatoriosTier !== "export_raw",
    canAccessRelatoriosInsights: relatoriosTier === "ai_insights",
    canUpgradeAnytime: planCode !== "enterprise",
    allowsCustomAddons: PLAN_NEGOTIABLE_ADDONS[planCode].length > 0,
  };
}

/** Crédito proporcional ao fazer upgrade (0–1 do ciclo restante). */
export function calcularProrataCredito(
  periodStart: Date,
  periodEnd: Date,
  ref = new Date(),
): number {
  const start = periodStart.getTime();
  const end = periodEnd.getTime();
  if (end <= start) return 0;
  const total = end - start;
  const remaining = Math.max(0, end - ref.getTime());
  return Math.min(1, remaining / total);
}
