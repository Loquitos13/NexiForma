import type { GuidedFlowModule } from "./guided-flow-types";

const crm = (ent: { canAccessCrm: boolean }) => ent.canAccessCrm;

/** Fluxos guiados CRM / negócio. */
export const GUIDED_FLOW_CRM: GuidedFlowModule[] = [
  {
    id: "crm-criar-lead",
    title: "Criar uma lead",
    description: "Registar um contacto comercial e acompanhar no pipeline.",
    category: "negocio",
    audiences: ["gestor", "comercial"],
    visible: ({ ent, canManageCrm }) => canManageCrm && crm(ent),
    steps: [
      {
        title: "Abrir leads",
        description: "Vai a CRM → Leads para ver o pipeline e a lista de contactos.",
        href: "/portal/crm/leads",
        helpPrompt: "Como crio e acompanho uma lead no CRM?",
      },
      {
        title: "Nova lead",
        description:
          "Clica em «Nova lead», preenche nome, email/telefone, origem e entidade (se já existir).",
        href: "/portal/crm/leads",
        tip: "Usa o NIF ou nome da empresa para associar a um cliente existente.",
        anchor: "nova-lead",
      },
      {
        title: "Estado no funil",
        description:
          "Na lista ou Kanban, avança a lead (ex.: Contactado, Qualificar). O responsável comercial é quem regista a oportunidade - vês na coluna «Responsável».",
        href: "/portal/crm/leads",
        tip: "Isto não é uma nota comercial. Notas comerciais são outro fluxo (interacções e follow-ups).",
      },
      {
        title: "Seguir no dashboard",
        description: "Confirma no CRM Dashboard ou na ficha da lead as próximas acções sugeridas.",
        href: "/portal/crm",
        roleVariants: {
          comercial: {
            title: "Próximas acções",
            description:
              "Na lista de leads, usa «Notas & IA» ou as sugestões na linha para planear o follow-up.",
            href: "/portal/crm/leads",
          },
        },
      },
    ],
  },
  {
    id: "crm-nota-comercial",
    title: "Criar uma nota comercial",
    description: "Registar interacções, reuniões e follow-ups com leads ou clientes.",
    category: "negocio",
    audiences: ["gestor", "comercial"],
    visible: ({ ent, canManageCrm }) => canManageCrm && crm(ent),
    steps: [
      {
        title: "Abrir notas comerciais",
        description: "Vai a CRM → Notas comerciais (interacções).",
        href: "/portal/crm/interaccoes",
      },
      {
        title: "Nova nota",
        description:
          "Associa a nota a uma lead ou cliente, escolhe o tipo (chamada, email, reunião, outro) e escreve o resumo.",
      },
      {
        title: "Reunião Teams (opcional)",
        description:
          "Se for reunião, podes criar/ligar sala Teams e, no fim, terminar a reunião com notas.",
        tip: "As notas ficam no histórico da entidade e alimentam sugestões IA (se o módulo estiver activo).",
      },
      {
        title: "Confirmar na ficha",
        description: "Abre a lead/cliente e verifica que a interacção aparece na timeline.",
      },
    ],
  },
  {
    id: "crm-calendario",
    title: "Calendário comercial",
    description: "Agendar e consultar reuniões e compromissos do CRM.",
    category: "negocio",
    audiences: ["gestor", "comercial"],
    visible: ({ ent, canManageCrm }) => canManageCrm && crm(ent),
    steps: [
      {
        title: "Abrir calendário",
        description: "Usa o Calendário do portal (vista partilhada com a equipa comercial).",
        href: "/portal/calendario",
      },
      {
        title: "Criar evento / reunião",
        description:
          "Cria um evento ligado a lead ou cliente, com data, hora e participantes.",
        tip: "Podes também criar a reunião a partir de uma nota comercial.",
      },
      {
        title: "Acompanhar o dia",
        description: "Consulta a vista semanal/diária para não perder follow-ups.",
      },
    ],
  },
  {
    id: "crm-proposta",
    title: "Criar e enviar proposta",
    description: "Gerar uma proposta comercial a partir de um cliente ou lead.",
    category: "negocio",
    audiences: ["gestor", "comercial"],
    visible: ({ ent, canManageCrm }) => canManageCrm && crm(ent),
    steps: [
      {
        title: "Abrir propostas",
        description: "Vai a Propostas no menu CRM.",
        href: "/portal/propostas",
      },
      {
        title: "Nova proposta",
        description:
          "Selecciona cliente/lead, adiciona linhas (formação, valores, descontos) e grava o rascunho.",
      },
      {
        title: "Pré-visualizar e enviar",
        description:
          "Revê o documento, envia o link de resposta ao cliente e acompanha o estado (aceite/recusado).",
        tip: "O modelo padrão edita-se em Propostas → «Modelo padrão» (gestor ou coordenador comercial).",
      },
    ],
  },
  {
    id: "crm-cliente",
    title: "Gerir clientes e parceiros",
    description: "Ficha de cliente, documentos e histórico comercial.",
    category: "negocio",
    audiences: ["gestor", "comercial"],
    visible: ({ ent, canManageCrm }) => canManageCrm && crm(ent),
    steps: [
      {
        title: "Lista de clientes",
        description: "Abre Clientes para pesquisar por nome ou NIF.",
        href: "/portal/clientes",
      },
      {
        title: "Ficha do cliente",
        description:
          "Consulta propostas, notas, contactos e sugestões. Actualiza dados fiscais quando necessário.",
      },
      {
        title: "Parceiros",
        description: "Usa Parceiros para entidades com relação comercial distinta.",
        href: "/portal/parceiros",
      },
    ],
  },
  {
    id: "crm-dashboard",
    title: "Pipeline e dashboard CRM",
    description: "Visão geral do funil, alertas e atalhos do dia.",
    category: "negocio",
    audiences: ["gestor", "comercial"],
    visible: ({ ent, canManageCrm, role }) =>
      canManageCrm && crm(ent) && role !== "comercial",
    steps: [
      {
        title: "Abrir CRM Dashboard",
        description: "Vai a CRM Dashboard para o resumo do pipeline.",
        href: "/portal/crm",
      },
      {
        title: "Prioridades do dia",
        description:
          "Usa leads quentes, notas pendentes e sugestões IA (se activas) para planear contactos.",
      },
    ],
  },
  {
    id: "faturacao",
    title: "Faturação",
    description: "Emitir faturas e configurar dados fiscais AT.",
    category: "negocio",
    audiences: ["gestor", "comercial"],
    visible: ({ ent, canManageFaturacao }) =>
      canManageFaturacao && ent.canAccessFaturacao,
    steps: [
      {
        title: "Dados de faturação",
        description: "Confirma série, dados fiscais e configuração AT.",
        href: "/portal/crm/faturacao",
        helpPrompt: "Como configuro a faturação e emito uma fatura?",
      },
      {
        title: "Emitir fatura",
        description: "Em Faturas, cria a partir de proposta aceite ou directamente.",
        href: "/portal/crm/faturas",
        anchor: "nova-fatura",
      },
    ],
  },
];
