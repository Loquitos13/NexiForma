import { NEXIGUIA_CAPABILITIES, NEXIGUIA_INTRO } from "./identity";

export type GuideKnowledgeEntry = {
  id: string;
  /** Palavras e frases que activam esta resposta */
  keywords: string[];
  answer: string;
  related?: string[];
};

/** Conhecimento estático sobre o NexiForma - respostas locais, sem LLM. */
export const GUIDE_KNOWLEDGE: GuideKnowledgeEntry[] = [
  {
    id: "nexigui",
    keywords: [
      "nexigui",
      "quem es",
      "quem és",
      "como te chamas",
      "teu nome",
      "qual o teu nome",
      "qual é o teu nome",
      "como te chamo",
      "o que es",
      "o que és",
      "o que fazes",
      "para que serves",
      "assistente",
      "chatbot",
      "bot",
    ],
    answer: NEXIGUIA_INTRO,
    related: ["/#funcionalidades", "/portal"],
  },
  {
    id: "nexiforma",
    keywords: [
      "o que e nexiforma",
      "o que é nexiforma",
      "para que serve",
      "o que faz",
      "explica nexiforma",
    ],
    answer:
      "O NexiForma é uma plataforma SaaS para entidades formadoras certificadas DGERT em Portugal. Reúne dossiê pedagógico, LMS, assiduidade, CRM comercial, faturação AT, exports SIGO e operação multi-tenant num só fluxo.",
    related: ["/", "/#funcionalidades", "/login"],
  },
  {
    id: "dgert",
    keywords: [
      "dgert",
      "inspecao",
      "inspeccao",
      "compliance",
      "conformidade",
      "checklist",
    ],
    answer:
      "A área Compliance DGERT reúne o checklist regulatório (14 requisitos obrigatórios). Quando estão cumpridos, o Dossiê & Exports gera automaticamente 14 documentos para auditoria - num clique, em minutos.",
    related: ["/portal/compliance", "/portal/dossie", "/portal/fluxo"],
  },
  {
    id: "sigo",
    keywords: ["sigo", "dgeec", "export sigo", "comunicar sigo", "enviar sigo"],
    answer:
      "O módulo SIGO permite exportar dados formativos em JSON, CSV ou via API para comunicação com a DGEEC. Configura credenciais em Integrações antes de exportar.",
    related: ["/portal/sigo", "/portal/integracoes"],
  },
  {
    id: "lms",
    keywords: [
      "lms",
      "assiduidade",
      "presencas",
      "presenca",
      "zoom",
      "teams",
      "scorm",
      "online",
    ],
    answer:
      "A assiduidade e as sessões online (Zoom/Teams) gerem-se nas Acções e no calendário da sessão. Os Conteúdos LMS e o Progresso LMS cobrem módulos SCORM e progresso dos formandos.",
    related: ["/portal/acoes", "/portal/conteudos", "/portal/progresso-lms"],
  },
  {
    id: "leads",
    keywords: [
      "lead",
      "leads",
      "prospeccao",
      "oportunidade comercial",
      "converter lead",
    ],
    answer:
      "Leads gere prospeção comercial: estados NOVO → CONTACTADO → QUALIFICADO → CONVERTIDO ou PERDIDO. Podes converter um lead em entidade B2B e criar proposta a partir dele.",
    related: ["/portal/crm/leads", "/portal/propostas", "/portal/entidades"],
  },
  {
    id: "propostas",
    keywords: ["proposta", "propostas", "orcamento", "cotacao"],
    answer:
      "Propostas comerciais ligam-se a entidades cliente. Após aceitação, a operação formativa e contratos completam o ciclo B2B dentro do CRM.",
    related: ["/portal/propostas", "/portal/contratos", "/portal/entidades"],
  },
  {
    id: "faturas",
    keywords: [
      "fatura",
      "faturas",
      "faturacao",
      "at",
      "autoridade tributaria",
      "saft",
      "emitir fatura",
    ],
    answer:
      "Faturas permite emitir documentos fiscais integrados com a AT. Configura primeiro os Dados de faturação (séries, NIF, parâmetros). Export SAF-T PT disponível no CRM.",
    related: ["/portal/crm/faturas", "/portal/crm/faturacao", "/portal/integracoes"],
  },
  {
    id: "acoes",
    keywords: [
      "acao formativa",
      "acoes formativas",
      "turma",
      "sumario",
      "sumarios",
      "sessao formativa",
    ],
    answer:
      "Cada ação formativa agrupa turmas, sessões e sumários. É o núcleo operacional: matrículas, presenças LMS e dossiê derivam da ação.",
    related: ["/portal/acoes", "/portal/matriculas", "/portal/progresso-lms"],
  },
  {
    id: "certificados",
    keywords: ["certificado", "certificados", "assinatura", "sumario pdf"],
    answer:
      "Certificados emite documentos de conclusão com QR verificável. Sumários podem ser assinados internamente ou com upload de PDF assinado no dossiê pedagógico.",
    related: ["/portal/certificados", "/portal/dossie"],
  },
  {
    id: "formador",
    keywords: [
      "formador",
      "perfil formador",
      "meu perfil",
      "minha conta",
      "definicoes formador",
      "configuracoes formador",
      "alterar perfil",
      "ver perfil",
    ],
    answer:
      "O formador gere o seu perfil em «O meu perfil» (dados pessoais, palavra-passe e documentos obrigatórios como CV, identificação e CCP). Também trabalha em cursos, ações formativas, LMS, conteúdos, calendário (quando atribuído) e RGPD em consulta. As Configurações da entidade ficam com o gestor.",
    related: ["/portal/formador/perfil", "/portal/cursos", "/portal/acoes", "/portal/conteudos"],
  },
  {
    id: "formando",
    keywords: [
      "portal formando",
      "formando",
      "aluno",
      "inscricao formando",
      "como me inscrevo",
    ],
    answer:
      "O portal do formando inclui calendário, inscrições, conteúdos, quizzes SCORM e perfil (incluindo exportação RGPD). Acede após matrícula activa.",
    related: ["/portal/formando", "/portal/formando/inscricoes", "/portal/formando/catalogo"],
  },
  {
    id: "rgpd",
    keywords: ["rgpd", "gdpr", "dados pessoais", "privacidade", "consentimento"],
    answer:
      "RGPD gere consentimentos e direitos dos titulares. Todos os utilizadores podem consultar as suas definições RGPD no portal. Formandos acedem em Privacidade; restantes roles em Conta → RGPD.",
    related: ["/portal/rgpd", "/portal/formando/rgpd", "/portal/formando/perfil"],
  },
  {
    id: "integracoes",
    keywords: [
      "integracao",
      "integracoes",
      "stripe",
      "webservice",
      "api key",
    ],
    answer:
      "Integrações liga serviços reais (AT, SIGO, mail, SMS, Stripe, Zoom/Teams). Em produção cada integração activa com credenciais válidas ou fica explicitamente desactivada.",
    related: ["/portal/integracoes", "/portal/enterprise"],
  },
  {
    id: "enterprise",
    keywords: ["sso", "oidc", "enterprise", "chaves api", "api publica"],
    answer:
      "Enterprise inclui SSO OIDC para login corporativo e chaves API por tenant. A especificação OpenAPI está disponível para integrações externas.",
    related: ["/portal/enterprise", "/portal/integracoes"],
  },
  {
    id: "utilizadores",
    keywords: [
      "utilizador",
      "utilizadores",
      "convite",
      "permissoes",
      "papel",
      "role",
      "mfa",
    ],
    answer:
      "Utilizadores gere contas, convites e papéis (gestor, formador, comercial, formando). MFA pode ser exigido para gestores - activa em Configurações.",
    related: ["/portal/utilizadores", "/portal/configuracoes"],
  },
  {
    id: "multi-tenant",
    keywords: ["multi tenant", "tenant", "entidade formadora", "subscricao", "billing"],
    answer:
      "Cada entidade formadora é um tenant isolado. Subscrição e billing Stripe gerem o plano SaaS. Super-admins operam tenants na Plataforma.",
    related: ["/portal/billing", "/plataforma/tenantes"],
  },
  {
    id: "ufcd",
    keywords: ["ufcd", "catalogo ufcd", "referencial"],
    answer:
      "Catálogo UFCD associa referenciais oficiais aos cursos. Útil para alinhar ações formativas com áreas e códigos certificados.",
    related: ["/portal/catalogo-ufcd", "/portal/cursos"],
  },
  {
    id: "limites",
    keywords: [
      "o que podes fazer",
      "o que consegues",
      "limites",
      "limitacoes",
      "ajuda",
    ],
    answer: NEXIGUIA_CAPABILITIES,
    related: ["/#funcionalidades", "/portal"],
  },
];
