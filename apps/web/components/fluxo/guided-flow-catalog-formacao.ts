import type { GuidedFlowModule } from "./guided-flow-types";

const core = (ent: { canAccessCoreFormation: boolean }) => ent.canAccessCoreFormation;
const coreOrTeams = (ent: {
  canAccessCoreFormation: boolean;
  canAccessFormacaoTeams: boolean;
}) => ent.canAccessCoreFormation || ent.canAccessFormacaoTeams;

/** Fluxos guiados de formação (gestor, formador, formando). */
export const GUIDED_FLOW_FORMACAO: GuidedFlowModule[] = [
  {
    id: "setup-completo",
    title: "Nova formação completa",
    description: "Curso → acção → conteúdos LMS → sessão, passo a passo (wizard).",
    category: "formacao",
    audiences: ["gestor"],
    view: "setup-completo",
    visible: ({ ent, canManageFormacao }) => canManageFormacao && core(ent),
    steps: [
      {
        title: "Curso",
        description:
          "Define designação, código UFCD, carga horária e modalidade. Podes seleccionar um curso existente ou criar novo.",
        href: "/portal/fluxo?v=setup-completo",
        tip: "O curso é a base do catálogo - todas as acções formativas ligam-se a um curso.",
      },
      {
        title: "Acção",
        description:
          "Cria a acção formativa (edição) ligada ao curso: código interno, título, datas e estado.",
        href: "/portal/fluxo?v=setup-completo",
      },
      {
        title: "Conteúdos",
        description:
          "Opcional: editor LMS (vídeo, PDF, quiz) associado ao curso. Podes saltar e voltar mais tarde.",
        href: "/portal/fluxo?v=setup-completo",
        tip: "Os módulos são partilhados por todas as acções do mesmo curso.",
      },
      {
        title: "Sessão",
        description:
          "Opcional: cronograma, presenças QR e sala Teams na ficha da acção.",
        href: "/portal/fluxo?v=setup-completo",
      },
    ],
  },
  {
    id: "formacao-criar-curso",
    title: "Criar um curso",
    description: "Registar um curso no catálogo da entidade.",
    category: "formacao",
    audiences: ["gestor"],
    visible: ({ ent, canManageFormacao }) => canManageFormacao && core(ent),
    steps: [
      {
        title: "Abrir cursos",
        description: "Vai a Formação → Cursos.",
        href: "/portal/cursos",
      },
      {
        title: "Novo curso",
        description:
          "Define designação, código, duração, área e metadados DGERT/SIGO necessários.",
        href: "/portal/cursos",
        anchor: "novo-curso",
      },
      {
        title: "Guardar e continuar",
        description:
          "Com o curso criado, podes abrir a ficha e criar uma acção formativa ou conteúdos LMS.",
        tip: "Para o percurso completo usa «Nova formação completa».",
        href: "/portal/fluxo?v=setup-completo",
      },
    ],
  },
  {
    id: "formacao-criar-acao",
    title: "Criar uma acção de formação",
    description: "Abrir uma edição (acção) ligada a um curso existente.",
    category: "formacao",
    audiences: ["gestor"],
    visible: ({ ent, canManageFormacao }) => canManageFormacao && core(ent),
    steps: [
      {
        title: "Abrir acções",
        description: "Vai a Formação → Acções.",
        href: "/portal/acoes",
      },
      {
        title: "Nova acção",
        description:
          "Escolhe o curso, datas, modalidade (presencial / online / mista), local e estado.",
        href: "/portal/acoes",
        anchor: "nova-acao",
      },
      {
        title: "Configurar a edição",
        description:
          "Na ficha da acção define turmas, documentos de inscrição, formadores e cronograma.",
        tip: "Sem acção não consegues matricular formandos nem criar sessões.",
      },
    ],
  },
  {
    id: "formacao-adicionar-formandos",
    title: "Adicionar formandos",
    description: "Convidar ou matricular formandos numa turma/acção.",
    category: "formacao",
    audiences: ["gestor"],
    visible: ({ ent, canManageFormacao }) => canManageFormacao && core(ent),
    steps: [
      {
        title: "Formandos ou inscrições",
        description: "Usa Formandos para criar o perfil, ou Inscrições para matricular numa turma.",
        href: "/portal/formandos",
      },
      {
        title: "Convite / conta",
        description:
          "Em Utilizadores podes convidar com cargo Formando; o perfil fica ligado ao email.",
        href: "/portal/utilizadores",
        tip: "NIF é obrigatório para convites de formando.",
        anchor: "convidar-utilizador",
      },
      {
        title: "Matricular na turma",
        description:
          "Na acção ou em Inscrições associa o formando à turma e confirma documentos obrigatórios.",
        href: "/portal/matriculas",
      },
    ],
  },
  {
    id: "formacao-atribuir-formadores",
    title: "Atribuir formadores",
    description: "Associar formadores a uma acção completa ou a sessões concretas.",
    category: "formacao",
    audiences: ["gestor"],
    visible: ({ ent, canManageFormacao }) => canManageFormacao && core(ent),
    steps: [
      {
        title: "Garantir perfil de formador",
        description: "Em Formadores ou Utilizadores confirma que o formador tem perfil e documentos.",
        href: "/portal/formadores",
      },
      {
        title: "Atribuir à acção",
        description:
          "Na ficha da acção usa a atribuição de formador à acção (aplica-se às sessões da edição).",
        href: "/portal/acoes",
        tip: "Também podes atribuir formador sessão a sessão no cronograma.",
      },
      {
        title: "Notificar",
        description:
          "O formador recebe email/notificação e passa a ver as sessões no calendário e no portal.",
      },
    ],
  },
  {
    id: "formacao-cronograma",
    title: "Criar cronograma",
    description: "Planear sessões, módulos e prazos LMS da acção.",
    category: "formacao",
    audiences: ["gestor"],
    visible: ({ ent, canManageFormacao }) => canManageFormacao && core(ent),
    steps: [
      {
        title: "Abrir a acção",
        description: "Entra na ficha da acção formativa.",
        href: "/portal/acoes",
      },
      {
        title: "Cronograma",
        description:
          "Cria ou importa o cronograma (sessões, datas, módulos, prazos de autoaprendizagem).",
      },
      {
        title: "Exportar / validar",
        description:
          "Revê o cronograma (incl. exportação VNG se aplicável) e publica as sessões.",
        tip: "Sessões sem formador ou sala ficam incompletas para presença online.",
      },
    ],
  },
  {
    id: "formacao-sumario",
    title: "Escrever sumário da sessão",
    description: "Registar o sumário pedagógico após a sessão.",
    category: "formacao",
    audiences: ["gestor", "formador"],
    visible: ({ ent }) => coreOrTeams(ent),
    steps: [
      {
        title: "Abrir a sessão",
        description:
          "Gestor: ficha da acção → sessão. Formador: calendário ou lista de sessões atribuídas.",
        href: "/portal/calendario",
        helpPrompt: "Como registo o sumário de uma sessão de formação?",
      },
      {
        title: "Preencher sumário",
        description:
          "Regista conteúdos dados, metodologias, incidências e anexa PDF se necessário.",
      },
      {
        title: "Guardar",
        description: "O sumário fica no dossiê da acção para compliance DGERT.",
      },
    ],
  },
  {
    id: "formacao-pauta",
    title: "Registar pauta por módulo",
    description: "Grelha de notas finais (0–100) na ficha da acção, tab Pauta.",
    category: "formacao",
    audiences: ["gestor", "formador"],
    visible: ({ ent }) => coreOrTeams(ent),
    steps: [
      {
        title: "Abrir acções",
        description: "Vai a Formação → Acções e escolhe a acção em curso.",
        href: "/portal/acoes",
        helpPrompt: "Onde registo a pauta de notas por módulo numa acção?",
      },
      {
        title: "Tab Pauta",
        description:
          "Na ficha da acção abre a tab «Pauta». Filtra por turma se precisares.",
        tip: "O formador só edita módulos das sessões que lhe estão atribuídas.",
      },
      {
        title: "Introduzir notas",
        description:
          "Preenche 0–100 em cada célula. A nota guarda-se ao sair do campo (ou Enter). Usa «Exportar CSV» para arquivo.",
      },
    ],
  },
  {
    id: "formacao-sessao-presencial",
    title: "Iniciar sessão presencial e presenças",
    description: "Abrir sessão presencial/híbrida e registar assiduidade (QR ou lista).",
    category: "formacao",
    audiences: ["gestor", "formador"],
    visible: ({ ent }) => coreOrTeams(ent),
    steps: [
      {
        title: "Localizar a sessão",
        description: "No calendário ou na acção, abre a sessão presencial/híbrida do dia.",
        href: "/portal/calendario",
      },
      {
        title: "Iniciar / QR",
        description:
          "Usa «Presença QR» para os formandos marcarem entrada, ou regista na folha de presenças.",
        tip: "O ecrã QR é de ecrã cheio  ideal para projectar na sala.",
      },
      {
        title: "Fechar folha",
        description: "Confirma faltas/presenças e grava a folha antes de terminar o dia.",
      },
    ],
  },
  {
    id: "formacao-sessao-online",
    title: "Sessão online e presença assíncrona",
    description: "Sala Teams/Zoom, presença na reunião e registos assíncronos LMS.",
    category: "formacao",
    audiences: ["gestor", "formador"],
    visible: ({ ent }) => coreOrTeams(ent),
    steps: [
      {
        title: "Sala da sessão",
        description:
          "Na sessão, cria/abre a reunião Teams (ou integração activa) e partilha o link.",
        href: "/portal/acoes",
        tip: "Abre a acção e a sessão no calendário para criar/abrir a sala.",
      },
      {
        title: "Durante a reunião",
        description:
          "A assiduidade online pode ser sincronizada pela integração; confirma o painel na sessão.",
      },
      {
        title: "Assíncrono / LMS",
        description:
          "Para trabalho assíncrono, libertar conteúdos e prazos LMS; o progresso conta na assiduidade LMS.",
        href: "/portal/progresso-lms",
      },
    ],
  },
  {
    id: "formacao-conteudos-lms",
    title: "Registar conteúdos LMS num curso",
    description: "Editor de curso com modos Editar e Mockup (vídeo, PDF, quiz, webinar).",
    category: "formacao",
    audiences: ["gestor"],
    view: "conteudos",
    visible: ({ ent, canManageFormacao }) => canManageFormacao && core(ent),
    steps: [
      {
        title: "Abrir editor",
        description:
          "Selecciona o curso e usa o editor com modos Editar e Mockup para criar módulos (vídeo, PDF, quiz, webinar).",
        href: "/portal/fluxo?v=conteudos",
        tip: "No Mockup vês o percurso como o formando e podes criar conteúdos a partir daí.",
      },
      {
        title: "Estruturar e publicar",
        description:
          "Organiza unidades e módulos, carrega ficheiros ou URLs, e publica quando o conteúdo estiver completo.",
        href: "/portal/fluxo?v=conteudos",
        tip: "Alterna Editar/Mockup para validar a experiência antes de publicar.",
      },
      {
        title: "Datas na acção",
        description:
          "Na ficha da acção, separador Tarefas, define desbloqueio e prazos LMS por módulo ou data do cronograma.",
        href: "/portal/acoes",
        tip: "As datas aplicam-se à acção; o conteúdo base permanece partilhado pelo curso.",
      },
    ],
  },
  {
    id: "formacao-libertar-lms",
    title: "Libertar conteúdos LMS",
    description: "Publicar módulos e definir prazos de desbloqueio por turma/acção.",
    category: "formacao",
    audiences: ["gestor"],
    visible: ({ ent, canManageFormacao }) => canManageFormacao && core(ent),
    steps: [
      {
        title: "Conteúdos no curso",
        description: "Garante que os módulos existem e estão publicados no curso.",
        href: "/portal/fluxo?v=conteudos",
      },
      {
        title: "Tarefas na acção",
        description:
          "Na ficha da acção, separador Tarefas, define prazos LMS e desbloqueio por módulo ou cronograma.",
        href: "/portal/acoes",
      },
      {
        title: "Validar progresso",
        description: "Em Progresso LMS confirma que os formandos vêem os conteúdos certos.",
        href: "/portal/progresso-lms",
      },
    ],
  },
  {
    id: "formacao-dgert",
    title: "Qualidade e DGERT",
    description: "Compliance, dossiê, certificados e SIGO.",
    category: "formacao",
    audiences: ["gestor"],
    visible: ({ ent, canManageFormacao }) => canManageFormacao && core(ent),
    steps: [
      {
        title: "Compliance",
        description: "Revê o checklist DGERT da entidade e das acções.",
        href: "/portal/compliance",
      },
      {
        title: "Dossiê e certificados",
        description: "Exporta dossiê pedagógico e emite/consulta certificados.",
        href: "/portal/dossie",
      },
      {
        title: "SIGO",
        description: "Quando aplicável, sincroniza ou exporta para o SIGO.",
        href: "/portal/sigo",
      },
    ],
  },
  //  Formador 
  {
    id: "formador-perfil",
    title: "O meu perfil e documentos",
    description: "Actualizar dados, CCP, CV, ficha DGERT e palavra-passe.",
    category: "formacao",
    audiences: ["formador"],
    visible: ({ ent }) => coreOrTeams(ent),
    steps: [
      {
        title: "Abrir perfil",
        description: "Em Conta → O meu perfil.",
        href: "/portal/formador/perfil",
      },
      {
        title: "Dados e segurança",
        description: "Actualiza contactos e palavra-passe nas tabs Dados e Segurança.",
      },
      {
        title: "Documentos obrigatórios",
        description:
          "Envia Cartão de Cidadão, CCP, certificados, currículo e ficha DGERT assinada.",
        href: "/portal/formador/perfil?tab=documentos",
      },
    ],
  },
  {
    id: "formador-calendario-sessoes",
    title: "As minhas sessões",
    description: "Consultar calendário e preparar sessões atribuídas.",
    category: "formacao",
    audiences: ["formador"],
    visible: ({ ent }) => coreOrTeams(ent),
    steps: [
      {
        title: "Calendário",
        description: "Vê as sessões em que estás atribuído.",
        href: "/portal/calendario",
      },
      {
        title: "Preparar a sessão",
        description: "Abre a sessão para sala online, QR de presença ou sumário.",
      },
    ],
  },
  {
    id: "formador-presenca-qr",
    title: "Presenças com QR (presencial)",
    description: "Projectar o QR e validar a entrada dos formandos.",
    category: "formacao",
    audiences: ["formador"],
    visible: ({ ent }) => coreOrTeams(ent),
    steps: [
      {
        title: "Abrir a sessão do dia",
        description: "No calendário, selecciona a sessão presencial.",
        href: "/portal/calendario",
      },
      {
        title: "Presença QR",
        description: "Abre o modo QR e projecta no ecrã da sala.",
      },
      {
        title: "Confirmar lista",
        description: "Revê quem entrou e grava a folha de presenças.",
      },
    ],
  },
  //  Formando 
  {
    id: "formando-perfil",
    title: "O meu perfil e documentos",
    description: "Dados pessoais, segurança e documentos obrigatórios.",
    category: "formacao",
    audiences: ["formando"],
    visible: ({ ent }) => coreOrTeams(ent),
    steps: [
      {
        title: "Abrir perfil",
        description: "No portal do formando, abre O meu perfil.",
        href: "/portal/formando/perfil",
      },
      {
        title: "Documentos",
        description:
          "Envia cópia do CC, certificado de habilitações e comprovativo de IBAN (e outros se pedido).",
        href: "/portal/formando/perfil?tab=documentos",
        anchor: "documentos-formando",
      },
    ],
  },
  {
    id: "formando-inscricao",
    title: "Inscrições e catálogo",
    description: "Ver formações disponíveis e o estado das matrículas.",
    category: "formacao",
    audiences: ["formando"],
    visible: ({ ent }) => coreOrTeams(ent),
    steps: [
      {
        title: "Catálogo",
        description: "Consulta formações abertas.",
        href: "/portal/formando/catalogo",
      },
      {
        title: "Minhas inscrições",
        description: "Acompanha matrículas e documentos pedidos pela entidade.",
        href: "/portal/formando/inscricoes",
      },
    ],
  },
  {
    id: "formando-aprendizagem",
    title: "Aprendizagem e LMS",
    description: "Aceder a conteúdos, quizzes e progresso da formação.",
    category: "formacao",
    audiences: ["formando"],
    visible: ({ ent }) => coreOrTeams(ent),
    steps: [
      {
        title: "Início do formando",
        description: "No dashboard vês as formações activas.",
        href: "/portal/formando",
      },
      {
        title: "Conteúdos",
        description: "Entra na aprendizagem da matrícula e completa os módulos libertados.",
      },
      {
        title: "Calendário",
        description: "Consulta sessões e reuniões no calendário do formando.",
        href: "/portal/formando/calendario",
      },
    ],
  },
];
