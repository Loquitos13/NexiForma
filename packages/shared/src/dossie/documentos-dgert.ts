/** 14 documentos automatizados - um por requisito obrigatório DGERT. */
export type DossieDgertDocumentoDef = {
  ordem: number;
  checklistId: string;
  label: string;
  filename: string;
  descricao: string;
};

export const DOSSIE_DGERT_DOCUMENTOS: DossieDgertDocumentoDef[] = [
  {
    ordem: 1,
    checklistId: "entidade_nif",
    label: "Entidade formadora",
    filename: "01-entidade-formadora.json",
    descricao: "NIF e identificação da entidade certificada.",
  },
  {
    ordem: 2,
    checklistId: "curso_ufcd",
    label: "Referencial UFCD/CNQ",
    filename: "02-referencial-ufcd.json",
    descricao: "Código UFCD ou CNQ associado ao curso.",
  },
  {
    ordem: 3,
    checklistId: "curso_objetivos",
    label: "Objectivos de aprendizagem",
    filename: "03-objectivos-curso.json",
    descricao: "Objectivos pedagógicos certificados do curso.",
  },
  {
    ordem: 4,
    checklistId: "curso_carga_horas",
    label: "Carga horária",
    filename: "04-carga-horaria.json",
    descricao: "Horas certificadas e modalidade formativa.",
  },
  {
    ordem: 5,
    checklistId: "acao_periodo",
    label: "Período da acção",
    filename: "05-acao-formativa.json",
    descricao: "Datas de início e fim da acção formativa.",
  },
  {
    ordem: 6,
    checklistId: "cronograma",
    label: "Cronograma de formação",
    filename: "06-cronograma.json",
    descricao: "Versão do cronograma pedagógico (HTML separado se aprovado).",
  },
  {
    ordem: 7,
    checklistId: "sessoes_planeadas",
    label: "Plano de sessões",
    filename: "07-plano-sessoes.json",
    descricao: "Sessões planeadas com horários e formadores.",
  },
  {
    ordem: 8,
    checklistId: "formadores",
    label: "Equipa formadora",
    filename: "08-equipa-formadores.json",
    descricao: "Formadores atribuídos e qualificações CC/CPP.",
  },
  {
    ordem: 9,
    checklistId: "turmas_formandos",
    label: "Formandos matriculados",
    filename: "09-formandos-matriculados.csv",
    descricao: "Lista de matrículas activas por turma.",
  },
  {
    ordem: 10,
    checklistId: "nifs_formandos",
    label: "Validação NIF formandos",
    filename: "10-validacao-nifs-formandos.json",
    descricao: "Conformidade dos NIF dos formandos activos.",
  },
  {
    ordem: 11,
    checklistId: "sumarios",
    label: "Sumários de sessão",
    filename: "11-sumarios-sessoes.json",
    descricao: "Registo pedagógico das sessões realizadas.",
  },
  {
    ordem: 12,
    checklistId: "sumarios_assinados",
    label: "Assinaturas de sumários",
    filename: "12-sumarios-assinados.json",
    descricao: "Sumários imutáveis e assinados.",
  },
  {
    ordem: 13,
    checklistId: "assiduidade",
    label: "Folhas de presença",
    filename: "13-folhas-presenca.csv",
    descricao: "Registo detalhado de assiduidade por sessão.",
  },
  {
    ordem: 14,
    checklistId: "folhas_fechadas",
    label: "Assiduidade consolidada",
    filename: "14-assiduidade-consolidada.json",
    descricao: "Folhas fechadas e taxa global de presença.",
  },
];

export const DOSSIE_DGERT_TOTAL = DOSSIE_DGERT_DOCUMENTOS.length;
