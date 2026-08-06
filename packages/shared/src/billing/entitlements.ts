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

export type TenantSubscriptionStatus =
  | "TRIALING"
  | "ACTIVE"
  | "PAST_DUE"
  | "CANCELED"
  | "PAUSED";

export type TenantBillingStatus = "ACTIVE" | "TRIAL" | "SUSPENDED" | "ARCHIVED";

export type BillingAccessContext = {
  subscriptionStatus?: TenantSubscriptionStatus | null;
  tenantStatus?: TenantBillingStatus | null;
};

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
  /** SSO, chaves API e restantes funcionalidades Enterprise. */
  canAccessEnterpriseFeatures: boolean;
  /** Subscrição efectiva para módulos (TRIALING/ACTIVE/PAST_DUE). */
  subscriptionActive: boolean;
  canUpgradeAnytime: boolean;
  allowsCustomAddons: boolean;
  allowsStandaloneModules: boolean;
};

const ACTIVE_SUBSCRIPTION_STATUSES: readonly TenantSubscriptionStatus[] = [
  "TRIALING",
  "ACTIVE",
  "PAST_DUE",
];

function isSubscriptionModulesActive(
  subscriptionStatus?: TenantSubscriptionStatus | null,
): boolean {
  if (!subscriptionStatus) return true;
  return ACTIVE_SUBSCRIPTION_STATUSES.includes(subscriptionStatus);
}

function stripModuleAccess(ent: TenantEntitlements): TenantEntitlements {
  return {
    ...ent,
    subscriptionActive: false,
    canAccessCoreFormation: false,
    canAccessCrm: false,
    canAccessFaturacao: false,
    canAccessFormacaoTeams: false,
    canAccessInteligenciaIa: false,
    canAccessRelatoriosDashboard: false,
    canAccessRelatoriosInsights: false,
    canAccessEnterpriseFeatures: false,
  };
}

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
  access?: BillingAccessContext,
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

  const subscriptionActive = isSubscriptionModulesActive(access?.subscriptionStatus);

  const ent: TenantEntitlements = {
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
    /** Dashboard base incluído em todos os planos activos; widgets filtrados por módulos activos. */
    canAccessRelatoriosDashboard: subscriptionActive,
    canAccessRelatoriosInsights:
      subscriptionActive && effectiveRelatoriosTier === "ai_insights",
    canAccessEnterpriseFeatures: subscriptionActive && planCode === "enterprise",
    subscriptionActive,
    canUpgradeAnytime: planCode !== "enterprise",
    allowsCustomAddons: !isModular && (PLAN_NEGOTIABLE_ADDONS[planCode as keyof typeof PLAN_NEGOTIABLE_ADDONS]?.length ?? 0) > 0,
    allowsStandaloneModules: true,
  };

  if (!subscriptionActive) {
    return stripModuleAccess(ent);
  }

  return ent;
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
