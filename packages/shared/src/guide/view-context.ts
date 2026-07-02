import { GUIDE_DESTINATIONS } from "./destinations";
import type { GuideViewArea, GuideViewContext } from "./types";

type ViewRule = {
  prefix: string;
  label: string;
  description: string;
  area: GuideViewArea;
  detailLabel?: string;
  related?: string[];
  hints?: string[];
};

const RELATED_LABELS = new Map(
  GUIDE_DESTINATIONS.map((d) => [d.href, d.label] as const),
);

function relatedHrefs(hrefs: string[]) {
  return hrefs
    .map((href) => ({ href, label: RELATED_LABELS.get(href) ?? href }))
    .filter((r) => r.label);
}

const VIEW_RULES: ViewRule[] = [
  {
    prefix: "/portal/crm/faturas/",
    label: "Detalhe de fatura",
    detailLabel: "Detalhe de fatura",
    description: "Consulta, comunicação AT e histórico do documento fiscal.",
    area: "portal",
    related: ["/portal/crm/faturas", "/portal/crm/faturacao", "/portal/crm"],
    hints: ["voltar às faturas", "dados faturação", "CRM"],
  },
  {
    prefix: "/portal/crm/faturas",
    label: "Faturas",
    description: "Emissão e gestão de faturas certificadas.",
    area: "portal",
    related: ["/portal/crm/faturacao", "/portal/entidades", "/portal/crm"],
    hints: ["dados faturação", "entidades", "propostas"],
  },
  {
    prefix: "/portal/crm/leads",
    label: "Leads",
    description: "Prospeção comercial, qualificação e conversão em entidades.",
    area: "portal",
    related: ["/portal/propostas", "/portal/entidades", "/portal/crm"],
    hints: ["propostas", "entidades cliente", "CRM dashboard"],
  },
  {
    prefix: "/portal/crm/faturacao",
    label: "Dados de faturação",
    description: "Configuração fiscal, séries AT e parâmetros de emissão.",
    area: "portal",
    related: ["/portal/crm/faturas", "/portal/integracoes", "/portal/crm"],
    hints: ["faturas", "integrações AT", "CRM"],
  },
  {
    prefix: "/portal/crm",
    label: "CRM Dashboard",
    description: "Pipeline comercial, KPIs e visão geral de vendas.",
    area: "portal",
    related: ["/portal/crm/leads", "/portal/propostas", "/portal/crm/faturas"],
    hints: ["leads", "propostas", "faturas"],
  },
  {
    prefix: "/portal/acoes/",
    label: "Detalhe da ação formativa",
    description: "Turmas, sessões, sumários e matrículas da ação.",
    area: "portal",
    related: ["/portal/acoes", "/portal/lms", "/portal/dossie"],
    hints: ["LMS", "dossiê", "lista de ações"],
  },
  {
    prefix: "/portal/cursos/",
    label: "Detalhe do curso",
    description: "Estrutura pedagógica, módulos e UFCD associados.",
    area: "portal",
    related: ["/portal/cursos", "/portal/acoes", "/portal/catalogo-ufcd"],
    hints: ["ações formativas", "catálogo UFCD"],
  },
  {
    prefix: "/portal/clientes/",
    label: "Detalhe do cliente",
    description: "Ficha B2B, contratos e histórico comercial.",
    area: "portal",
    related: ["/portal/clientes", "/portal/propostas", "/portal/contratos"],
    hints: ["propostas", "contratos", "leads"],
  },
  {
    prefix: "/portal/formando/aprendizagem/",
    label: "Aprendizagem",
    description: "Percurso formativo, módulos e progresso do formando.",
    area: "portal",
    related: ["/portal/formando", "/portal/formando/calendario", "/portal/formando/inscricoes"],
    hints: ["calendário", "inscrições", "início"],
  },
  {
    prefix: "/portal/formando/conteudo/",
    label: "Conteúdo do módulo",
    description: "Aulas, materiais e atividades do módulo em curso.",
    area: "portal",
    related: ["/portal/formando", "/portal/formando/calendario"],
    hints: ["calendário", "início formando"],
  },
  {
    prefix: "/portal/formando/quiz/",
    label: "Quiz",
    description: "Avaliação interativa do módulo formativo.",
    area: "portal",
    related: ["/portal/formando", "/portal/formando/inscricoes"],
    hints: ["início", "inscrições"],
  },
  {
    prefix: "/portal/formando/scorm/",
    label: "Conteúdo SCORM",
    description: "Player SCORM e registo de progresso.",
    area: "portal",
    related: ["/portal/formando", "/portal/formando/catalogo"],
    hints: ["catálogo", "início"],
  },
  {
    prefix: "/portal/formando/perfil",
    label: "Perfil formando",
    description: "Dados pessoais, consentimentos e exportação RGPD.",
    area: "portal",
    related: ["/portal/formando", "/portal/formando/inscricoes"],
    hints: ["inscrições", "calendário"],
  },
  {
    prefix: "/portal/formando/calendario",
    label: "Calendário formando",
    description: "Sessões agendadas e horários das formações.",
    area: "portal",
    related: ["/portal/formando", "/portal/formando/inscricoes"],
    hints: ["inscrições", "catálogo"],
  },
  {
    prefix: "/portal/formando/inscricoes",
    label: "Minhas inscrições",
    description: "Estado das matrículas e formações activas.",
    area: "portal",
    related: ["/portal/formando", "/portal/formando/catalogo"],
    hints: ["catálogo", "calendário"],
  },
  {
    prefix: "/portal/formando/catalogo",
    label: "Catálogo formando",
    description: "Formações disponíveis para inscrição.",
    area: "portal",
    related: ["/portal/formando/inscricoes", "/portal/formando"],
    hints: ["inscrições", "início"],
  },
  {
    prefix: "/portal/formando/reuniao",
    label: "Sala online",
    description: "Sessão síncrona via Zoom ou Teams.",
    area: "portal",
    related: ["/portal/formando/calendario", "/portal/formando"],
    hints: ["calendário"],
  },
  {
    prefix: "/portal/formando",
    label: "Portal do formando",
    description: "Área principal com formações e próximas sessões.",
    area: "portal",
    related: ["/portal/formando/calendario", "/portal/formando/inscricoes", "/portal/formando/perfil"],
    hints: ["calendário", "inscrições", "perfil"],
  },
  {
    prefix: "/plataforma/tenantes/",
    label: "Detalhe do tenant",
    description: "Gestão de entidade formadora na plataforma.",
    area: "platform",
    related: ["/plataforma/tenantes", "/plataforma"],
    hints: ["tenants", "auditoria"],
  },
  {
    prefix: "/plataforma/tenantes",
    label: "Tenants",
    description: "Lista de entidades formadoras na plataforma.",
    area: "platform",
    related: ["/plataforma", "/plataforma/auditoria"],
    hints: ["dashboard plataforma", "auditoria"],
  },
  {
    prefix: "/plataforma/auditoria",
    label: "Auditoria plataforma",
    description: "Registo de acções críticas a nível global.",
    area: "platform",
    related: ["/plataforma", "/plataforma/tenantes"],
    hints: ["tenants", "RGPD plataforma"],
  },
  {
    prefix: "/plataforma/rgpd",
    label: "RGPD plataforma",
    description: "Consentimentos e privacidade a nível de plataforma.",
    area: "platform",
    related: ["/plataforma", "/plataforma/auditoria"],
    hints: ["auditoria", "tenants"],
  },
  {
    prefix: "/plataforma",
    label: "Control Plane",
    description: "Operação multi-tenant e administração da plataforma NexiForma.",
    area: "platform",
    related: ["/plataforma/tenantes", "/plataforma/auditoria"],
    hints: ["tenants", "auditoria", "RGPD"],
  },
  {
    prefix: "/login/plataforma",
    label: "Login plataforma",
    description: "Autenticação para administradores NexiForma.",
    area: "auth",
    related: ["/plataforma", "/"],
    hints: ["página inicial", "recuperar password"],
  },
  {
    prefix: "/login/recuperar",
    label: "Recuperar password",
    description: "Redefinição de palavra-passe do portal tenant.",
    area: "auth",
    related: ["/login", "/"],
    hints: ["entrar", "página inicial"],
  },
  {
    prefix: "/login",
    label: "Entrar",
    description: "Autenticação no portal da entidade formadora.",
    area: "auth",
    related: ["/", "/portal"],
    hints: ["página inicial", "funcionalidades"],
  },
  {
    prefix: "/brand",
    label: "Brand NexiForma",
    description: "Identidade visual e assets da marca.",
    area: "public",
    related: ["/", "/login"],
    hints: ["página inicial", "entrar"],
  },
  {
    prefix: "/acesso-negado",
    label: "Acesso negado",
    description: "Sem permissão para esta área com o perfil actual.",
    area: "auth",
    related: ["/portal", "/login"],
    hints: ["dashboard", "entrar"],
  },
  {
    prefix: "/cmd/assinar",
    label: "Assinatura CMD",
    description: "Fluxo de assinatura qualificada de certificados.",
    area: "public",
    related: ["/login", "/portal/certificados"],
    hints: ["certificados", "entrar"],
  },
  {
    prefix: "/convite/",
    label: "Convite",
    description: "Aceitar convite e activar conta de utilizador.",
    area: "auth",
    related: ["/login", "/"],
    hints: ["entrar"],
  },
  {
    prefix: "/verificar/",
    label: "Verificar certificado",
    description: "Validação pública de certificado emitido.",
    area: "public",
    related: ["/", "/login"],
    hints: ["página inicial"],
  },
];

function normalizePath(pathname: string): string {
  const base = pathname.split("?")[0]?.split("#")[0] ?? "/";
  if (base !== "/" && base.endsWith("/")) return base.slice(0, -1);
  return base || "/";
}

function matchDestination(path: string) {
  let best: (typeof GUIDE_DESTINATIONS)[number] | null = null;
  let bestLen = 0;
  for (const d of GUIDE_DESTINATIONS) {
    if (d.href.includes("#")) continue;
    if (path === d.href || path.startsWith(`${d.href}/`)) {
      if (d.href.length >= bestLen) {
        best = d;
        bestLen = d.href.length;
      }
    }
  }
  return best;
}

function areaFromPath(path: string): GuideViewArea {
  if (path.startsWith("/portal")) return "portal";
  if (path.startsWith("/plataforma")) return "platform";
  if (path.startsWith("/login") || path.startsWith("/convite")) return "auth";
  return "public";
}

/** Resolve contexto da view actual a partir do pathname. */
export function resolveViewContext(pathname: string): GuideViewContext {
  const path = normalizePath(pathname);

  if (path === "/") {
    return {
      pathname: path,
      area: "public",
      label: "Página inicial",
      description: "Website NexiForma - apresentação, funcionalidades e integrações.",
      related: relatedHrefs(["/login", "/#funcionalidades", "/#integracoes"]),
      hints: ["funcionalidades", "entrar", "integrações", "como funciona"],
    };
  }

  for (const rule of VIEW_RULES) {
    if (path === rule.prefix || path.startsWith(`${rule.prefix}/`)) {
      const isDetail = path !== rule.prefix && rule.detailLabel;
      return {
        pathname: path,
        area: rule.area,
        label: isDetail ? (rule.detailLabel ?? rule.label) : rule.label,
        description: rule.description,
        related: relatedHrefs(rule.related ?? []),
        hints: rule.hints ?? [],
      };
    }
  }

  const dest = matchDestination(path);
  if (dest) {
    return {
      pathname: path,
      area: areaFromPath(path),
      label: dest.label,
      description: dest.description,
      related: [],
      hints: dest.keywords.slice(0, 4),
    };
  }

  const area = areaFromPath(path);
  const fallbacks: Record<GuideViewArea, Omit<GuideViewContext, "pathname" | "area">> = {
    public: {
      label: "Website",
      description: "Navegação pública NexiForma.",
      related: relatedHrefs(["/", "/login"]),
      hints: ["página inicial", "entrar"],
    },
    auth: {
      label: "Autenticação",
      description: "Área de login e convites.",
      related: relatedHrefs(["/login", "/"]),
      hints: ["entrar", "página inicial"],
    },
    portal: {
      label: "Portal",
      description: "Área autenticada da entidade formadora.",
      related: relatedHrefs(["/portal", "/portal/acoes", "/portal/crm"]),
      hints: ["dashboard", "ações", "CRM"],
    },
    platform: {
      label: "Plataforma",
      description: "Administração global multi-tenant.",
      related: relatedHrefs(["/plataforma", "/plataforma/tenantes"]),
      hints: ["tenants", "auditoria"],
    },
  };

  const fb = fallbacks[area];
  return { pathname: path, area, ...fb };
}
