import {
  BILLING_ADDON_CODES,
  type BillingAddonCode,
  type BillingPlanCode,
  MODULAR_PLAN_CODE,
  PLAN_NATIVE_ADDONS,
  PLAN_NEGOTIABLE_ADDONS,
  PLAN_RELATORIOS_TIER,
  STANDALONE_PURCHASABLE_ADDONS,
  type RelatoriosTier,
} from "./plans-catalog";
import { resolveModuleFlags } from "./module-flags.util";

export type TenantEntitlements = {
  planCode: BillingPlanCode;
  customAddons: BillingAddonCode[];
  activeAddons: BillingAddonCode[];
  relatoriosTier: RelatoriosTier;
  /** Assinatura só-módulos (sem Core formação por defeito). */
  isModularSubscription: boolean;
  /** LMS, acções formativas, dossiê DGERT, etc. */
  canAccessCoreFormation: boolean;
  canAccessCrm: boolean;
  canAccessFaturacao: boolean;
  canAccessFormacaoTeams: boolean;
  canAccessInteligenciaIa: boolean;
  canAccessRelatoriosDashboard: boolean;
  canAccessRelatoriosInsights: boolean;
  canUpgradeAnytime: boolean;
  allowsCustomAddons: boolean;
  allowsStandaloneModules: boolean;
};

function parseAddonList(raw: unknown): BillingAddonCode[] {
  if (!Array.isArray(raw)) return [];
  const allowed = new Set<string>(BILLING_ADDON_CODES);
  return raw.filter((v): v is BillingAddonCode => typeof v === "string" && allowed.has(v));
}

function normalizePlanCode(code: string | null | undefined): BillingPlanCode {
  if (code === "pro" || code === "enterprise" || code === "modular") return code;
  return "starter";
}

/** Resolve entitlements efectivos: plano base + add-ons nativos + add-ons negociados / módulos avulsos. */
export function resolveTenantEntitlements(
  planCodeInput: string | null | undefined,
  customAddonsInput: unknown,
): TenantEntitlements {
  const planCode = normalizePlanCode(planCodeInput);
  const customAddons = parseAddonList(customAddonsInput);
  const isModular = planCode === MODULAR_PLAN_CODE;

  let validCustom: BillingAddonCode[];
  if (isModular) {
    const standalone = new Set<string>(STANDALONE_PURCHASABLE_ADDONS);
    validCustom = customAddons.filter((a) => standalone.has(a));
  } else {
    const negotiable = new Set(PLAN_NEGOTIABLE_ADDONS[planCode as keyof typeof PLAN_NEGOTIABLE_ADDONS] ?? []);
    validCustom = customAddons.filter((a) => negotiable.has(a));
  }

  const native = PLAN_NATIVE_ADDONS[planCode];
  const activeAddons = [...new Set([...native, ...validCustom])];
  const flags = resolveModuleFlags(activeAddons, planCode);
  const relatoriosTier = PLAN_RELATORIOS_TIER[planCode];

  const effectiveRelatoriosTier: RelatoriosTier =
    isModular && flags.hasInteligenciaIa ? "ai_insights" : relatoriosTier;

  return {
    planCode,
    customAddons: validCustom,
    activeAddons,
    relatoriosTier: effectiveRelatoriosTier,
    isModularSubscription: isModular,
    canAccessCoreFormation: flags.hasFormacaoCore,
    canAccessCrm: flags.hasCrm,
    canAccessFaturacao: flags.hasFaturacao,
    canAccessFormacaoTeams: flags.hasFormacaoTeams,
    canAccessInteligenciaIa: flags.hasInteligenciaIa,
    /** Dashboard base incluído em todos os planos; widgets filtrados por módulos activos. */
    canAccessRelatoriosDashboard: true,
    canAccessRelatoriosInsights: effectiveRelatoriosTier === "ai_insights",
    canUpgradeAnytime: planCode !== "enterprise",
    allowsCustomAddons: !isModular && (PLAN_NEGOTIABLE_ADDONS[planCode as keyof typeof PLAN_NEGOTIABLE_ADDONS]?.length ?? 0) > 0,
    allowsStandaloneModules: true,
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
