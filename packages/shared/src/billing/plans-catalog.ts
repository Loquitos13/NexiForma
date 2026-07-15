/** Códigos internos de plano (DB / Stripe). `pro` = Business na UI. */
export const BILLING_PLAN_CODES = ["starter", "pro", "enterprise", "modular"] as const;
export type BillingPlanCode = (typeof BILLING_PLAN_CODES)[number];

/** Planos Core expostos na tabela comparativa pública (exclui assinatura só-módulos). */
export const BILLING_CORE_PLAN_CODES = ["starter", "pro", "enterprise"] as const;
export type BillingCorePlanCode = (typeof BILLING_CORE_PLAN_CODES)[number];

export const BILLING_PLAN_LABELS: Record<BillingPlanCode, string> = {
  starter: "Starter",
  pro: "Business",
  enterprise: "Enterprise",
  modular: "Módulos à la carte",
};

/** Plano de subscrição só com módulos activos (sem Core formação). */
export const MODULAR_PLAN_CODE = "modular" as const;

export const BILLING_ADDON_CODES = [
  "crm",
  "faturacao_at",
  "formacao_core",
  "crm_faturacao",
  "formacao_teams",
  "inteligencia_ia",
] as const;
export type BillingAddonCode = (typeof BILLING_ADDON_CODES)[number];

export const BILLING_ADDON_LABELS: Record<BillingAddonCode, string> = {
  crm: "CRM Comercial",
  faturacao_at: "Faturação AT",
  formacao_core: "Formação Core",
  crm_faturacao: "CRM & Faturação (pacote)",
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
  values: Record<BillingCorePlanCode, PlanFeatureCell>;
};

export type BillingPlanSummary = {
  code: BillingPlanCode;
  name: string;
  tagline: string;
  highlighted?: boolean;
};

export type BillingCatalog = {
  model: "core_addons" | "core_or_modules";
  headline: string;
  subheadline: string;
  plans: BillingPlanSummary[];
  standaloneModules: BillingStandaloneModule[];
  comparisonRows: BillingComparisonRow[];
  policies: {
    upgrade: string;
    customAddons: string;
    standaloneModules: string;
    billing: string;
  };
};

export type BillingStandaloneModule = {
  code: BillingAddonCode;
  name: string;
  tagline: string;
  description: string;
  highlights: string[];
};

export const STANDALONE_MODULES: BillingStandaloneModule[] = [
  {
    code: "crm",
    name: "CRM Comercial",
    tagline: "Pipeline, leads, propostas e equipa comercial - sem faturação AT.",
    description:
      "Funil comercial, notas com IA, propostas formativas, clientes B2B e contratos. Ideal para equipas de vendas que ainda não precisam de faturação electrónica.",
    highlights: [
      "Leads e funil partilhado",
      "Notas comerciais com IA",
      "Propostas e contratos",
      "Role comercial dedicada",
    ],
  },
  {
    code: "faturacao_at",
    name: "Faturação AT",
    tagline: "Faturação electrónica, SAF-T PT e comunicação AT - autónomo.",
    description:
      "Emissão de faturas, séries, ATCUD, comunicação à Autoridade Tributária e exportação SAF-T. Clientes B2B incluídos para emitir documentos.",
    highlights: [
      "Faturas electrónicas PT",
      "SAF-T e séries AT",
      "Moradas legais PT",
      "Role financeiro / gestor",
    ],
  },
  {
    code: "formacao_core",
    name: "Formação Core",
    tagline: "Gestão formativa completa - LMS, cursos, dossiê DGERT.",
    description:
      "Plataforma formativa multi-tenant: cursos, acções, turmas, presenças, dossiê pedagógico e compliance - sem módulo comercial.",
    highlights: [
      "LMS e conteúdos",
      "Ações e turmas",
      "Dossiê DGERT",
      "Portal formando",
    ],
  },
  {
    code: "formacao_teams",
    name: "Formação Teams",
    tagline: "Sessões online Microsoft Teams com presenças automáticas.",
    description:
      "Integração Teams, salas online e registo de assiduidade - útil isoladamente ou combinado com Formação Core.",
    highlights: [
      "OAuth Microsoft 365",
      "Reuniões e calendário",
      "Presenças automáticas",
      "Portal formando (sessões)",
    ],
  },
  {
    code: "inteligencia_ia",
    name: "Inteligência & IA",
    tagline: "Análises avançadas, insights e automações com IA.",
    description:
      "Relatórios com IA, alertas de gargalo e camada de inteligência - activável como módulo único.",
    highlights: [
      "Insights comerciais e operacionais",
      "Relatórios PDF com IA",
      "NexiGuia contextual",
      "Alertas acionáveis",
    ],
  },
];

export const BILLING_CATALOG: BillingCatalog = {
  model: "core_or_modules",
  headline: "Core, módulos ou ambos",
  subheadline:
    "Assinatura Core para gestão formativa, ou módulos individuais (só CRM, só Faturação AT, só Formação) - combináveis à la carte.",
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
  standaloneModules: STANDALONE_MODULES,
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
      id: "mod_crm",
      category: "module",
      label: "CRM Comercial",
      description: "Pipeline, leads, propostas e notas comerciais.",
      values: {
        starter: { kind: "addon", hint: "Add-on disponível" },
        pro: { kind: "addon", hint: "Add-on disponível" },
        enterprise: { kind: "native", hint: "Incluído nativamente" },
      },
    },
    {
      id: "mod_faturacao_at",
      category: "module",
      label: "Faturação AT",
      description: "Faturas electrónicas, SAF-T PT e comunicação AT.",
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
      id: "commercial_standalone",
      category: "commercial",
      label: "Módulos à la carte",
      description: "Comprar apenas o módulo necessário, sem assinatura Core formação.",
      values: {
        starter: { kind: "text", text: "CRM, Faturação, Formação ou IA como módulo único" },
        pro: { kind: "text", text: "Qualquer módulo avulso ou add-on extra" },
        enterprise: { kind: "text", text: "Suite completa ou extensões pontuais" },
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
      "Num plano Core, a equipa comercial pode activar add-ons individuais (ex.: CRM num Starter), gerando fatura personalizada.",
    standaloneModules:
      "Cada módulo (CRM, Faturação AT, Formação Core, Teams ou IA) pode ser contratado isoladamente - ideal para clientes só-comercial, só-faturação ou só-formação.",
    billing:
      "Planos Core incluem Formação. Módulos avulsos facturam em separado. Combine Core + add-ons ou subscreva apenas os módulos necessários.",
  },
};

/** Módulos incluídos por plano (antes de add-ons negociados). */
export const PLAN_NATIVE_ADDONS: Record<BillingPlanCode, readonly BillingAddonCode[]> = {
  starter: [],
  pro: ["formacao_teams"],
  enterprise: ["crm", "faturacao_at", "formacao_teams", "inteligencia_ia"],
  modular: [],
};

/** Add-ons negociáveis em planos Core (além dos nativos). */
export const PLAN_NEGOTIABLE_ADDONS: Record<BillingCorePlanCode, readonly BillingAddonCode[]> = {
  starter: ["crm", "faturacao_at", "crm_faturacao", "formacao_teams", "formacao_core", "inteligencia_ia"],
  pro: ["crm", "faturacao_at", "crm_faturacao", "inteligencia_ia"],
  enterprise: [],
};

/** Módulos vendidos avulsos (plano modular ou lead comercial). Pacote legado incluído. */
export const STANDALONE_PURCHASABLE_ADDONS: readonly BillingAddonCode[] = [
  "crm",
  "faturacao_at",
  "formacao_core",
  "formacao_teams",
  "inteligencia_ia",
  "crm_faturacao",
];

export type RelatoriosTier = "export_raw" | "dashboards" | "ai_insights";

export const PLAN_RELATORIOS_TIER: Record<BillingPlanCode, RelatoriosTier> = {
  starter: "export_raw",
  pro: "dashboards",
  enterprise: "ai_insights",
  modular: "export_raw",
};
