/** Códigos internos de plano (DB / Stripe). `pro` = Business na UI. */
export const BILLING_PLAN_CODES = ["starter", "pro", "enterprise"] as const;
export type BillingPlanCode = (typeof BILLING_PLAN_CODES)[number];

export const BILLING_PLAN_LABELS: Record<BillingPlanCode, string> = {
  starter: "Starter",
  pro: "Business",
  enterprise: "Enterprise",
};

export const BILLING_ADDON_CODES = [
  "crm_faturacao",
  "formacao_teams",
  "inteligencia_ia",
] as const;
export type BillingAddonCode = (typeof BILLING_ADDON_CODES)[number];

export const BILLING_ADDON_LABELS: Record<BillingAddonCode, string> = {
  crm_faturacao: "CRM & Faturação",
  formacao_teams: "Formação Teams",
  inteligencia_ia: "Inteligência & IA",
};

export type PlanFeatureCell =
  | { kind: "included"; hint?: string }
  | { kind: "native"; hint?: string }
  | { kind: "addon"; hint?: string }
  | { kind: "unavailable" }
  | { kind: "text"; text: string };

export type BillingComparisonRow = {
  id: string;
  category: "core" | "module" | "reports" | "commercial";
  label: string;
  description?: string;
  values: Record<BillingPlanCode, PlanFeatureCell>;
};

export type BillingPlanSummary = {
  code: BillingPlanCode;
  name: string;
  tagline: string;
  highlighted?: boolean;
};

export type BillingCatalog = {
  model: "core_addons";
  headline: string;
  subheadline: string;
  plans: BillingPlanSummary[];
  comparisonRows: BillingComparisonRow[];
  policies: {
    upgrade: string;
    customAddons: string;
    billing: string;
  };
};

export const BILLING_CATALOG: BillingCatalog = {
  model: "core_addons",
  headline: "Core + Add-ons",
  subheadline:
    "Assinatura base obrigatória com módulos activáveis por plano ou negociação comercial - sem surpresas no tarifário público.",
  plans: [
    {
      code: "starter",
      name: "Starter",
      tagline: "Operação formativa essencial com exportação de dados.",
    },
    {
      code: "pro",
      name: "Business",
      tagline: "Crescimento comercial com dashboards e formação Teams.",
      highlighted: true,
    },
    {
      code: "enterprise",
      name: "Enterprise",
      tagline: "Suite completa, IA avançada e flexibilidade enterprise.",
    },
  ],
  comparisonRows: [
    {
      id: "core_platform",
      category: "core",
      label: "Plataforma multi-tenant",
      description: "Acesso à aplicação, portais e isolamento por entidade formadora.",
      values: {
        starter: { kind: "included" },
        pro: { kind: "included" },
        enterprise: { kind: "included" },
      },
    },
    {
      id: "core_chatbot",
      category: "core",
      label: "IA Chatbot",
      description: "Assistente contextual para equipas e formandos.",
      values: {
        starter: { kind: "included" },
        pro: { kind: "included" },
        enterprise: { kind: "included" },
      },
    },
    {
      id: "core_lms",
      category: "core",
      label: "LMS & gestão de conteúdos",
      description: "Percursos, SCORM, quizzes e portal do formando.",
      values: {
        starter: { kind: "included" },
        pro: { kind: "included" },
        enterprise: { kind: "included" },
      },
    },
    {
      id: "core_website",
      category: "core",
      label: "Website institucional",
      description: "Página pública da entidade formadora integrada na plataforma.",
      values: {
        starter: { kind: "included" },
        pro: { kind: "included" },
        enterprise: { kind: "included" },
      },
    },
    {
      id: "mod_crm_faturacao",
      category: "module",
      label: "CRM & Faturação",
      description: "Pipeline comercial, propostas, faturas AT e SAF-T PT.",
      values: {
        starter: { kind: "addon", hint: "Add-on disponível" },
        pro: { kind: "addon", hint: "Add-on disponível" },
        enterprise: { kind: "native", hint: "Incluído nativamente" },
      },
    },
    {
      id: "mod_formacao_teams",
      category: "module",
      label: "Formação Teams",
      description: "Sessões online, presenças automáticas e integração Microsoft Teams.",
      values: {
        starter: { kind: "unavailable" },
        pro: { kind: "included" },
        enterprise: { kind: "included" },
      },
    },
    {
      id: "mod_inteligencia_ia",
      category: "module",
      label: "Inteligência & IA",
      description: "Análises avançadas, automações e camada de IA dedicada.",
      values: {
        starter: { kind: "unavailable" },
        pro: { kind: "unavailable" },
        enterprise: { kind: "included" },
      },
    },
    {
      id: "rep_access",
      category: "reports",
      label: "Relatórios & analytics",
      description: "Nível de acesso aos relatórios de gestão.",
      values: {
        starter: {
          kind: "text",
          text: "Exportação de dados brutos (CSV / Excel)",
        },
        pro: {
          kind: "text",
          text: "Dashboards visuais e relatórios integrados",
        },
        enterprise: {
          kind: "text",
          text: "Relatórios com IA e exportação de insights estruturados",
        },
      },
    },
    {
      id: "commercial_upgrade",
      category: "commercial",
      label: "Upgrade de plano",
      description: "Mudança de plano a qualquer momento.",
      values: {
        starter: { kind: "text", text: "Upgrade imediato com prorata do valor restante" },
        pro: { kind: "text", text: "Upgrade imediato com prorata do valor restante" },
        enterprise: { kind: "text", text: "Renovação e expansão sob medida" },
      },
    },
    {
      id: "commercial_custom",
      category: "commercial",
      label: "Add-ons personalizados",
      description: "Módulos individuais em negociação directa com vendas.",
      values: {
        starter: { kind: "text", text: "Disponível via equipa comercial" },
        pro: { kind: "text", text: "Disponível via equipa comercial" },
        enterprise: { kind: "text", text: "Pacote completo + extensões à medida" },
      },
    },
  ],
  policies: {
    upgrade:
      "Pode fazer upgrade de plano a qualquer momento. O valor já pago no ciclo actual é creditado proporcionalmente (prorata) no novo plano.",
    customAddons:
      "A equipa de vendas pode activar módulos individuais em planos inferiores (ex.: CRM num Starter), gerando uma fatura personalizada sem alterar o tarifário público.",
    billing: "Todos os planos incluem a assinatura Core. Módulos add-on são facturados em separado quando activados.",
  },
};

/** Módulos incluídos por plano (antes de add-ons negociados). */
export const PLAN_NATIVE_ADDONS: Record<BillingPlanCode, readonly BillingAddonCode[]> = {
  starter: [],
  pro: ["formacao_teams"],
  enterprise: ["crm_faturacao", "formacao_teams", "inteligencia_ia"],
};

/** Add-ons que podem ser vendidos em negociação directa por plano. */
export const PLAN_NEGOTIABLE_ADDONS: Record<BillingPlanCode, readonly BillingAddonCode[]> = {
  starter: ["crm_faturacao", "formacao_teams"],
  pro: ["crm_faturacao"],
  enterprise: [],
};

export type RelatoriosTier = "export_raw" | "dashboards" | "ai_insights";

export const PLAN_RELATORIOS_TIER: Record<BillingPlanCode, RelatoriosTier> = {
  starter: "export_raw",
  pro: "dashboards",
  enterprise: "ai_insights",
};
