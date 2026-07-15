import {
  BILLING_ADDON_CODES,
  type BillingAddonCode,
  type BillingPlanCode,
  MODULAR_PLAN_CODE,
  PLAN_NEGOTIABLE_ADDONS,
  STANDALONE_PURCHASABLE_ADDONS,
} from "./plans-catalog";

export class TenantSubscriptionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TenantSubscriptionValidationError";
  }
}

export function normalizeTenantSubscriptionAddons(raw: unknown): BillingAddonCode[] {
  if (!Array.isArray(raw)) return [];
  const allowed = new Set<string>(BILLING_ADDON_CODES);
  return raw.filter((v): v is BillingAddonCode => typeof v === "string" && allowed.has(v));
}

/** Valida plano + módulos activados pelo super admin. */
export function assertValidTenantSubscription(
  planCode: BillingPlanCode,
  customAddonsInput: unknown,
): BillingAddonCode[] {
  const customAddons = normalizeTenantSubscriptionAddons(customAddonsInput);

  if (planCode === MODULAR_PLAN_CODE) {
    if (customAddons.length === 0) {
      throw new TenantSubscriptionValidationError(
        "Plano «Módulos à la carte» requer pelo menos um módulo activo.",
      );
    }
    const allowed = new Set<string>(STANDALONE_PURCHASABLE_ADDONS);
    const invalid = customAddons.filter((a) => !allowed.has(a));
    if (invalid.length) {
      throw new TenantSubscriptionValidationError(`Módulos inválidos: ${invalid.join(", ")}`);
    }
    return customAddons;
  }

  const negotiable = new Set(
    PLAN_NEGOTIABLE_ADDONS[planCode as keyof typeof PLAN_NEGOTIABLE_ADDONS] ?? [],
  );
  const invalid = customAddons.filter((a) => !negotiable.has(a));
  if (invalid.length) {
    throw new TenantSubscriptionValidationError(
      `Add-ons não negociáveis no plano ${planCode}: ${invalid.join(", ")}`,
    );
  }
  return customAddons;
}
