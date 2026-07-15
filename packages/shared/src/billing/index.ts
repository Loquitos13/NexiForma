export {
  BILLING_ADDON_CODES,
  BILLING_ADDON_LABELS,
  BILLING_CATALOG,
  BILLING_CORE_PLAN_CODES,
  BILLING_PLAN_CODES,
  BILLING_PLAN_LABELS,
  MODULAR_PLAN_CODE,
  PLAN_NATIVE_ADDONS,
  PLAN_NEGOTIABLE_ADDONS,
  PLAN_RELATORIOS_TIER,
  STANDALONE_MODULES,
  STANDALONE_PURCHASABLE_ADDONS,
  type BillingAddonCode,
  type BillingCatalog,
  type BillingComparisonRow,
  type BillingCorePlanCode,
  type BillingPlanCode,
  type BillingPlanSummary,
  type BillingStandaloneModule,
  type PlanFeatureCell,
  type RelatoriosTier,
} from "./plans-catalog";

export {
  calcularProrataCredito,
  resolveTenantEntitlements,
  type TenantEntitlements,
} from "./entitlements";

export {
  resolveModuleFlags,
  LEGACY_CRM_FATURACAO_BUNDLE,
  type ResolvedModuleFlags,
} from "./module-flags.util";

export {
  assertValidTenantSubscription,
  normalizeTenantSubscriptionAddons,
  TenantSubscriptionValidationError,
} from "./subscription-admin";

export {
  INTEGRATION_PLUGINS,
  hasAnyIntegrationPlugin,
  isIntegracaoProviderAllowed,
  isIntegrationPluginAllowed,
  type IntegrationPluginDef,
  type IntegrationPluginId,
} from "./integration-plugins";

export {
  API_ALWAYS_ALLOWED_PREFIXES,
  API_PUBLIC_PREFIXES,
  PORTAL_ALWAYS_PATHS,
  defaultPortalHome,
  isApiPathAllowed,
  isApiPathExempt,
  isApiPathPublic,
  isPortalPathAllowedByEntitlements,
  navHrefAllowedByEntitlements,
  normalizeApiPath,
} from "./module-access";
