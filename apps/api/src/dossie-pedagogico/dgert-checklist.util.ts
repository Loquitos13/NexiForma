import { isValidNifPt } from "./sigo-validation.util";

export type DgertChecklistItem = {
  id: string;
  label: string;
  ok: boolean;
  detalhe?: string;
  /** Agrupamento para painéis de compliance */
  grupo: "catalogo" | "planeamento" | "equipa" | "participantes" | "execucao" | "entidade";
  /** Obrigatório para inspecção DGERT vs recomendado */
  severidade: "obrigatorio" | "recomendado";
  /** Acção sugerida quando não cumprido */
  accaoSugerida?: string;
};

export type DgertChecklistInput = {
  tenantNif: string | null;
  curso: {
    codigoUfcd: string | null;
    objetivos: string | null;
    cargaHoras: number;
    modalidade: string;
  };
  acao: {
    dataInicio: Date;
    dataFim: Date;
    estado: string;
  };
  cronograma: {
    versao: number;
    aprovadoEm: Date | null;
  } | null;
  sessoes: Array<{
    numeroSessao: number;
    horaInicio: string;
    horaFim: string;
    modalidade: string;
    estado: string;
    formador: {
      nif: string;
      ccNumero: string | null;
      ccpNumero: string | null;
    } | null;
    sumarios: Array<{ imutavel: boolean; assinadoEm: Date | null; conteudo: string }>;
    folhasPresenca: Array<{
      fechadaEm: Date | null;
      validadaFormadorEm?: Date | null;
      presencas: Array<{ presente: boolean }>;
    }>;
  }>;
  formandosAtivos: Array<{ nome: string; nif: string }>;
  totalMatriculas: number;
  presencasPresentes: number;
  presencasTotal: number;
};

const GRUPO_LABELS: Record<DgertChecklistItem["grupo"], string> = {
  catalogo: "Catálogo formativo",
  planeamento: "Planeamento",
  equipa: "Equipa formadora",
  participantes: "Participantes",
  execucao: "Execução e registo",
  entidade: "Entidade formadora",
};

function sessionMinutes(horaInicio: string, horaFim: string): number {
  const [ih, im] = horaInicio.split(":").map(Number);
  const [fh, fm] = horaFim.split(":").map(Number);
  return fh * 60 + fm - (ih * 60 + im);
}

export function buildDgertChecklist(input: DgertChecklistInput): {
  items: DgertChecklistItem[];
  grupos: Array<{ id: DgertChecklistItem["grupo"]; label: string; concluidos: number; total: number }>;
  concluidos: number;
  total: number;
  scorePercent: number;
  scoreObrigatorioPercent: number;
  concluidosObrigatorios: number;
  totalObrigatorios: number;
  prontoInspecao: boolean;
} {
  const { curso, acao, cronograma, sessoes } = input;

  const formadoresMap = new Map<string, NonNullable<(typeof sessoes)[0]["formador"]>>();
  for (const s of sessoes) {
    if (s.formador) formadoresMap.set(s.formador.nif, s.formador);
  }

  const sessoesRealizadas = sessoes.filter((s) => s.estado === "REALIZADA");
  const sessoesRealizadasComSumario = sessoesRealizadas.filter((s) =>
    s.sumarios.some((sum) => sum.imutavel || sum.conteudo.length >= 10),
  );
  const sessoesRealizadasAssinadas = sessoesRealizadas.filter((s) =>
    s.sumarios.some((sum) => sum.imutavel && sum.assinadoEm),
  );
  const sessoesComFolha = sessoes.filter((s) => s.folhasPresenca.length > 0);
  const folhaConcluida = (f: { fechadaEm: Date | null; validadaFormadorEm?: Date | null }) =>
    Boolean(f.fechadaEm || f.validadaFormadorEm);
  const folhasFechadas = sessoes
    .flatMap((s) => s.folhasPresenca.filter(folhaConcluida))
    .length;
  const realizadasComFolhaFechada = sessoesRealizadas.filter((s) =>
    s.folhasPresenca.some(folhaConcluida),
  );

  const minutosSessoes = sessoes.reduce(
    (acc, s) => acc + sessionMinutes(s.horaInicio, s.horaFim),
    0,
  );
  const horasSessoes = Math.round((minutosSessoes / 60) * 10) / 10;
  const cargaOk =
    sessoes.length === 0 ||
    horasSessoes >= curso.cargaHoras * 0.85;

  const formandosNifInvalidos = input.formandosAtivos.filter((f) => !isValidNifPt(f.nif));
  const formadoresSemQualificacao = [...formadoresMap.values()].filter(
    (f) => !f.ccNumero?.trim() && !f.ccpNumero?.trim(),
  );

  const taxaPresenca =
    input.presencasTotal > 0
      ? Math.round((input.presencasPresentes / input.presencasTotal) * 100)
      : null;

  const items: DgertChecklistItem[] = [
    {
      id: "entidade_nif",
      grupo: "entidade",
      severidade: "obrigatorio",
      label: "NIF da entidade formadora válido",
      ok: Boolean(input.tenantNif?.trim()) && isValidNifPt(input.tenantNif ?? ""),
      detalhe: input.tenantNif ?? undefined,
      accaoSugerida: "Actualizar NIF da entidade nas definições do tenant.",
    },
    {
      id: "curso_ufcd",
      grupo: "catalogo",
      severidade: "obrigatorio",
      label: "Curso com código UFCD/CNQ registado",
      ok: Boolean(curso.codigoUfcd?.trim()),
      detalhe: curso.codigoUfcd ?? undefined,
      accaoSugerida: "Associar código UFCD ao curso no catálogo.",
    },
    {
      id: "curso_objetivos",
      grupo: "catalogo",
      severidade: "obrigatorio",
      label: "Objectivos de aprendizagem descritos",
      ok: Boolean(curso.objetivos?.trim()),
      accaoSugerida: "Completar objectivos no registo do curso.",
    },
    {
      id: "curso_carga_horas",
      grupo: "catalogo",
      severidade: "obrigatorio",
      label: "Carga horária certificada definida",
      ok: curso.cargaHoras > 0,
      detalhe: `${curso.cargaHoras}h · ${curso.modalidade}`,
    },
    {
      id: "acao_periodo",
      grupo: "planeamento",
      severidade: "obrigatorio",
      label: "Período da acção coerente (início ≤ fim)",
      ok: acao.dataFim >= acao.dataInicio,
    },
    {
      id: "acao_estado",
      grupo: "planeamento",
      severidade: "recomendado",
      label: "Acção não cancelada",
      ok: acao.estado !== "CANCELADA",
      detalhe: acao.estado,
    },
    {
      id: "cronograma",
      grupo: "planeamento",
      severidade: "obrigatorio",
      label: "Cronograma de formação existente",
      ok: Boolean(cronograma),
      detalhe: cronograma ? `versão ${cronograma.versao}` : undefined,
      accaoSugerida: "Criar cronograma para a acção de formação.",
    },
    {
      id: "cronograma_aprovado",
      grupo: "planeamento",
      severidade: "recomendado",
      label: "Cronograma aprovado pelo responsável pedagógico",
      ok: Boolean(cronograma?.aprovadoEm),
      detalhe: cronograma?.aprovadoEm
        ? new Date(cronograma.aprovadoEm).toLocaleDateString("pt-PT")
        : undefined,
      accaoSugerida: "Aprovar cronograma após validação pedagógica.",
    },
    {
      id: "sessoes_planeadas",
      grupo: "planeamento",
      severidade: "obrigatorio",
      label: "Sessões planeadas no cronograma",
      ok: sessoes.length > 0,
      detalhe: `${sessoes.length} sessão(ões)`,
      accaoSugerida: "Adicionar sessões ao cronograma.",
    },
    {
      id: "carga_horaria_cronograma",
      grupo: "planeamento",
      severidade: "recomendado",
      label: "Horas planeadas alinhadas com carga certificada (≥85%)",
      ok: cargaOk,
      detalhe: `${horasSessoes}h planeadas / ${curso.cargaHoras}h certificadas`,
      accaoSugerida: "Rever duração das sessões face à carga horária do curso.",
    },
    {
      id: "formadores",
      grupo: "equipa",
      severidade: "obrigatorio",
      label: "Formador(es) atribuído(s) às sessões",
      ok: formadoresMap.size > 0,
      detalhe: `${formadoresMap.size} formador(es)`,
    },
    {
      id: "formador_qualificacao",
      grupo: "equipa",
      severidade: "recomendado",
      label: "Formadores com CC ou CCP registado",
      ok: formadoresMap.size === 0 || formadoresSemQualificacao.length === 0,
      detalhe:
        formadoresSemQualificacao.length > 0
          ? `${formadoresSemQualificacao.length} sem CC/CPP`
          : undefined,
      accaoSugerida: "Registar certificado de competências pedagógicas dos formadores.",
    },
    {
      id: "turmas_formandos",
      grupo: "participantes",
      severidade: "obrigatorio",
      label: "Formandos matriculados activos",
      ok: input.totalMatriculas > 0,
      detalhe: `${input.totalMatriculas} matrícula(s)`,
    },
    {
      id: "nifs_formandos",
      grupo: "participantes",
      severidade: "obrigatorio",
      label: "NIF válido para todos os formandos activos",
      ok: input.formandosAtivos.length === 0 || formandosNifInvalidos.length === 0,
      detalhe:
        formandosNifInvalidos.length > 0
          ? `${formandosNifInvalidos.length} inválido(s)`
          : undefined,
      accaoSugerida: "Corrigir NIF dos formandos antes de exportação SIGO.",
    },
    {
      id: "sumarios",
      grupo: "execucao",
      severidade: "obrigatorio",
      label: "Sumários das sessões realizadas",
      ok:
        sessoesRealizadas.length === 0 ||
        sessoesRealizadasComSumario.length >= sessoesRealizadas.length,
      detalhe: `${sessoesRealizadasComSumario.length}/${sessoesRealizadas.length} realizadas`,
    },
    {
      id: "sumarios_assinados",
      grupo: "execucao",
      severidade: "obrigatorio",
      label: "Sumários assinados (imutáveis) nas sessões realizadas",
      ok:
        sessoesRealizadas.length === 0 ||
        sessoesRealizadasAssinadas.length >= sessoesRealizadas.length,
      detalhe: `${sessoesRealizadasAssinadas.length}/${sessoesRealizadas.length} assinados`,
      accaoSugerida: "Assinar sumários após cada sessão realizada.",
    },
    {
      id: "assiduidade",
      grupo: "execucao",
      severidade: "obrigatorio",
      label: "Folhas de presença abertas",
      ok: sessoesComFolha.length > 0,
      detalhe: `${sessoesComFolha.length} sessão(ões) com folha`,
    },
    {
      id: "folhas_fechadas",
      grupo: "execucao",
      severidade: "obrigatorio",
      label: "Folhas de presença fechadas (sessões realizadas)",
      ok:
        sessoesRealizadas.length === 0 ||
        realizadasComFolhaFechada.length >= sessoesRealizadas.length,
      detalhe: `${folhasFechadas} fechada(s) · ${realizadasComFolhaFechada.length}/${sessoesRealizadas.length} realizadas`,
      accaoSugerida: "Validar folhas após registo de presenças.",
    },
    {
      id: "taxa_assiduidade",
      grupo: "execucao",
      severidade: "recomendado",
      label: "Taxa global de presença ≥ 75% (referência DGERT)",
      ok: taxaPresenca == null || taxaPresenca >= 75,
      detalhe: taxaPresenca != null ? `${taxaPresenca}%` : undefined,
      accaoSugerida: "Acompanhar assiduidade e aplicar medidas de recuperação.",
    },
  ];

  const obrigatorios = items.filter((i) => i.severidade === "obrigatorio");
  const concluidos = items.filter((i) => i.ok).length;
  const concluidosObrigatorios = obrigatorios.filter((i) => i.ok).length;

  const grupos = (Object.keys(GRUPO_LABELS) as DgertChecklistItem["grupo"][]).map((id) => {
    const grupoItems = items.filter((i) => i.grupo === id);
    return {
      id,
      label: GRUPO_LABELS[id],
      concluidos: grupoItems.filter((i) => i.ok).length,
      total: grupoItems.length,
    };
  });

  return {
    items,
    grupos,
    concluidos,
    total: items.length,
    scorePercent: Math.round((concluidos / items.length) * 100),
    scoreObrigatorioPercent: Math.round((concluidosObrigatorios / obrigatorios.length) * 100),
    concluidosObrigatorios,
    totalObrigatorios: obrigatorios.length,
    prontoInspecao: concluidosObrigatorios === obrigatorios.length,
  };
}
