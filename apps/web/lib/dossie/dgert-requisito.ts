/** Query param usado ao saltar do dossiê para a view onde o requisito se resolve. */
export const DGERT_REQUISITO_PARAM = "requisito";

export type DgertRequisitoGuide = {
  id: string;
  label: string;
  /** Instrução concreta para o gestor nesta view. */
  instruction: string;
  /** Alvo visual opcional (data-dgert-target / campo). */
  target?: string;
};

export const DGERT_REQUISITO_GUIDE: Record<string, DgertRequisitoGuide> = {
  entidade_nif: {
    id: "entidade_nif",
    label: "NIF da entidade formadora",
    instruction:
      "Actualize o NIF da entidade no formulário abaixo e guarde. O valor fica na ficha da empresa (visível também ao superadmin).",
    target: "entidade_nif",
  },
  curso_ufcd: {
    id: "curso_ufcd",
    label: "Código UFCD / CNQ",
    instruction: "Preencha o código UFCD/CNQ do curso e guarde.",
    target: "curso_ufcd",
  },
  curso_objetivos: {
    id: "curso_objetivos",
    label: "Objectivos de aprendizagem",
    instruction: "Descreva os objectivos de aprendizagem do curso e guarde.",
    target: "curso_objetivos",
  },
  curso_carga_horas: {
    id: "curso_carga_horas",
    label: "Carga horária",
    instruction: "Defina a carga horária certificada (horas) do curso e guarde.",
    target: "curso_carga_horas",
  },
  acao_periodo: {
    id: "acao_periodo",
    label: "Período da acção",
    instruction: "Edite as datas de início e fim para que o início seja ≤ ao fim.",
    target: "acao_periodo",
  },
  acao_estado: {
    id: "acao_estado",
    label: "Estado da acção",
    instruction: "Altere o estado da acção (não deve estar Cancelada para inspecção).",
    target: "acao_estado",
  },
  cronograma: {
    id: "cronograma",
    label: "Cronograma de formação",
    instruction: "Crie ou seleccione um cronograma para esta acção.",
    target: "cronograma_panel",
  },
  cronograma_aprovado: {
    id: "cronograma_aprovado",
    label: "Aprovação do cronograma",
    instruction: "Aprove o cronograma como responsável pedagógico (botão de aprovação).",
    target: "cronograma_aprovar",
  },
  sessoes_planeadas: {
    id: "sessoes_planeadas",
    label: "Sessões planeadas",
    instruction: "Adicione sessões ao cronograma com data e horário.",
    target: "cronograma_sessoes",
  },
  carga_horaria_cronograma: {
    id: "carga_horaria_cronograma",
    label: "Horas do cronograma",
    instruction: "Ajuste a duração das sessões para cobrir ≥85% da carga certificada.",
    target: "cronograma_sessoes",
  },
  formadores: {
    id: "formadores",
    label: "Formadores nas sessões",
    instruction: "Atribua um formador a cada sessão do cronograma.",
    target: "cronograma_sessoes",
  },
  formador_qualificacao: {
    id: "formador_qualificacao",
    label: "CC / CCP dos formadores",
    instruction: "Abra o formador sem CC/CCP e registe o número e validade da credencial.",
    target: "formadores_lista",
  },
  turmas_formandos: {
    id: "turmas_formandos",
    label: "Formandos matriculados",
    instruction: "Crie uma turma (se necessário) e matricule formandos activos.",
    target: "turmas_panel",
  },
  nifs_formandos: {
    id: "nifs_formandos",
    label: "NIF dos formandos",
    instruction: "Corrija o NIF inválido no campo abaixo e guarde a ficha do formando.",
    target: "formando_nif",
  },
  documentos_matricula: {
    id: "documentos_matricula",
    label: "Documentos de matrícula",
    instruction: "Arquive contratos / documentos de inscrição nas matrículas da turma.",
    target: "turmas_panel",
  },
  sumarios: {
    id: "sumarios",
    label: "Sumários de sessão",
    instruction:
      "Termine a sessão primeiro. Depois abra «Registar sumário», escreva o conteúdo (≥10 caracteres) e continue para assinar.",
    target: "sessao_sumario",
  },
  sumarios_assinados: {
    id: "sumarios_assinados",
    label: "Assinatura de sumários",
    instruction:
      "Após terminar a sessão, no modal do sumário avance para o passo 2 e confirme a assinatura com o nome (ou carregue PDF assinado).",
    target: "sessao_sumario",
  },
  assiduidade: {
    id: "assiduidade",
    label: "Folhas de presença",
    instruction: "Abra a folha de presença nas sessões e registe as assiduidades.",
    target: "cronograma_presencas",
  },
  folhas_fechadas: {
    id: "folhas_fechadas",
    label: "Fechar / validar folhas",
    instruction: "Feche ou valide as folhas de presença das sessões já realizadas.",
    target: "cronograma_presencas",
  },
  taxa_assiduidade: {
    id: "taxa_assiduidade",
    label: "Taxa de presença",
    instruction: "Reveja as presenças; a taxa global deve ficar ≥75% (referência DGERT).",
    target: "cronograma_presencas",
  },
  avaliacoes_formandos: {
    id: "avaliacoes_formandos",
    label: "Avaliações",
    instruction: "Seleccione a acção/turma e registe a avaliação de cada formando activo.",
    target: "avaliacoes_form",
  },
  certificados_emitidos: {
    id: "certificados_emitidos",
    label: "Certificados",
    instruction: "Seleccione a acção e emita certificados para os formandos elegíveis.",
    target: "certificados_lista",
  },
};

export function getDgertRequisitoGuide(id: string | null | undefined): DgertRequisitoGuide | null {
  if (!id) return null;
  return DGERT_REQUISITO_GUIDE[id] ?? null;
}

export function appendDgertRequisito(href: string, checklistId: string): string {
  const sep = href.includes("?") ? "&" : "?";
  return `${href}${sep}${DGERT_REQUISITO_PARAM}=${encodeURIComponent(checklistId)}`;
}

export type DgertRequisitoHrefCtx = {
  acaoId: string;
  cursoId?: string;
  /** Primeiro formando com NIF inválido (para requisito nifs_formandos). */
  formandoIdNifInvalido?: string;
};

/** Destino onde o requisito em falta pode ser concluído. */
export function resolveDgertRequisitoHref(
  checklistId: string,
  ctx: DgertRequisitoHrefCtx,
): string | null {
  const { acaoId, cursoId, formandoIdNifInvalido } = ctx;
  if (
    !acaoId &&
    !["entidade_nif", "formador_qualificacao", "nifs_formandos"].includes(checklistId)
  ) {
    return null;
  }
  const acao = (tab: string) =>
    appendDgertRequisito(`/portal/acoes/${acaoId}?tab=${tab}`, checklistId);

  switch (checklistId) {
    case "entidade_nif":
      return appendDgertRequisito("/portal/configuracoes", checklistId);
    case "curso_ufcd":
    case "curso_objetivos":
    case "curso_carga_horas":
      return cursoId
        ? appendDgertRequisito(`/portal/cursos?edit=${cursoId}`, checklistId)
        : appendDgertRequisito("/portal/cursos", checklistId);
    case "acao_periodo":
    case "acao_estado":
      return acao("resumo");
    case "cronograma":
    case "cronograma_aprovado":
    case "sessoes_planeadas":
    case "carga_horaria_cronograma":
    case "formadores":
    case "sumarios":
    case "sumarios_assinados":
    case "assiduidade":
    case "folhas_fechadas":
    case "taxa_assiduidade":
      return acao("cronograma");
    case "formador_qualificacao":
      return appendDgertRequisito("/portal/formadores", checklistId);
    case "nifs_formandos":
      if (formandoIdNifInvalido) {
        return appendDgertRequisito(
          `/portal/formandos/${formandoIdNifInvalido}`,
          checklistId,
        );
      }
      return appendDgertRequisito("/portal/formandos", checklistId);
    case "turmas_formandos":
      return acao("turmas");
    case "documentos_matricula":
      return acao("documentos");
    case "avaliacoes_formandos":
      return acao("pauta");
    case "certificados_emitidos":
      return appendDgertRequisito(
        `/portal/certificados?acao=${encodeURIComponent(acaoId)}`,
        checklistId,
      );
    default:
      return acaoId ? acao("compliance") : null;
  }
}

/** Validação sintática NIF PT (alinhada com a API). */
export function isValidNifPtClient(nif: string): boolean {
  const d = nif.replace(/\s/g, "").trim();
  if (!/^\d{9}$/.test(d)) return false;
  const checkDigit = Number(d[8]);
  let sum = 0;
  for (let i = 0; i < 8; i += 1) sum += Number(d[i]) * (9 - i);
  const rest = sum % 11;
  const expected = rest < 2 ? 0 : 11 - rest;
  return checkDigit === expected;
}

export function readDgertRequisitoFromSearch(search: string): string | null {
  const raw = new URLSearchParams(search).get(DGERT_REQUISITO_PARAM);
  return raw?.trim() || null;
}
