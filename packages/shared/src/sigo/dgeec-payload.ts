/** Contrato interno NexiForma (export manual / validação). */
export const SIGO_EXPORT_SCHEMA = "nexiforma.sigo_export.v1";

/** Payload orientado ao contrato DGEEC/SIGO (adaptável quando a API oficial for publicada). */
export const DGEEC_SUBMISSAO_SCHEMA = "dgeec.sigo_submissao.v1";

export type NexiformaSigoExportBody = {
  $schema?: string;
  exportadoEm?: string;
  entidadeFormadora: { nif: string | null; denominacao: string | null; slug?: string };
  acaoFormacao: {
    codigoInterno: string;
    titulo: string;
    estado?: string;
    dataInicio: string;
    dataFim: string;
  };
  cursoModulo: {
    codigoUfcd: string | null;
    designacao: string;
    cargaHoras: number;
    modalidade: string;
    objetivos?: string | null;
  };
  formadores: Array<{ nif: string; nome: string; email?: string | null }>;
  formandos: Array<{
    nif: string;
    nome: string;
    email?: string | null;
    telefone?: string | null;
    turmaCodigo?: string;
    matriculaId?: string;
    tipoDocIdentificacao?: string;
    numDocIdentificacao?: string;
    dataNascimento?: string;
    nacionalidade?: string;
    habilitacaoLiteraria?: string;
    assiduidade?: {
      taxaPresencaPercent: number | null;
    } | null;
  }>;
  planoFormativo?: Array<{
    numeroSessao: number;
    data: string;
    horaInicio?: string;
    horaFim?: string;
    modalidade?: string;
    estado?: string;
    formador?: { nif: string; nome: string } | null;
  }>;
  turmas?: Array<{ codigo: string; nome: string }>;
};

export type DgeecSigoSubmissaoPayload = {
  $schema: typeof DGEEC_SUBMISSAO_SCHEMA;
  versao: "1.0";
  origem: "NexiForma";
  referenciaExterna: string;
  exportadoEm: string;
  entidadeFormadora: {
    nif: string;
    denominacao: string;
  };
  acaoFormacao: {
    codigo: string;
    designacao: string;
    estado: string;
    dataInicio: string;
    dataFim: string;
  };
  moduloFormativo: {
    codigoUfcd: string;
    designacao: string;
    cargaHoraria: number;
    modalidade: string;
    objetivos: string | null;
  };
  formadores: Array<{ nif: string; nome: string; email: string | null }>;
  turmas: Array<{ codigo: string; designacao: string }>;
  formandos: Array<{
    nif: string;
    nome: string;
    email: string | null;
    telefone: string | null;
    codigoTurma: string | null;
    matriculaExternaId: string | null;
    taxaAssiduidadePercent: number | null;
  }>;
  planoSessoes: Array<{
    ordem: number;
    data: string;
    horaInicio: string | null;
    horaFim: string | null;
    modalidade: string | null;
    estado: string | null;
    formadorNif: string | null;
  }>;
  metadados: {
    pacoteNexiforma: typeof SIGO_EXPORT_SCHEMA;
  };
};

function requireNif(nif: string | null | undefined, fallback: string): string {
  const digits = String(nif ?? "").replace(/\D/g, "");
  return digits.length === 9 ? digits : fallback;
}

/** Converte pacote NexiForma para estrutura de submissão DGEEC-style. */
export function mapNexiformaToDgeecPayload(
  body: NexiformaSigoExportBody,
  referenciaExterna: string,
): DgeecSigoSubmissaoPayload {
  const entidadeNif = requireNif(body.entidadeFormadora.nif, "000000000");
  const ufcd = String(body.cursoModulo.codigoUfcd ?? "").trim() || "0000";

  return {
    $schema: DGEEC_SUBMISSAO_SCHEMA,
    versao: "1.0",
    origem: "NexiForma",
    referenciaExterna,
    exportadoEm: body.exportadoEm ?? new Date().toISOString(),
    entidadeFormadora: {
      nif: entidadeNif,
      denominacao: String(body.entidadeFormadora.denominacao ?? "Entidade formadora"),
    },
    acaoFormacao: {
      codigo: body.acaoFormacao.codigoInterno,
      designacao: body.acaoFormacao.titulo,
      estado: body.acaoFormacao.estado ?? "CONCLUIDA",
      dataInicio: body.acaoFormacao.dataInicio,
      dataFim: body.acaoFormacao.dataFim,
    },
    moduloFormativo: {
      codigoUfcd: ufcd,
      designacao: body.cursoModulo.designacao,
      cargaHoraria: body.cursoModulo.cargaHoras,
      modalidade: body.cursoModulo.modalidade,
      objetivos: body.cursoModulo.objetivos ?? null,
    },
    formadores: body.formadores.map((f) => ({
      nif: requireNif(f.nif, "000000000"),
      nome: f.nome,
      email: f.email ?? null,
    })),
    turmas: (body.turmas ?? []).map((t) => ({
      codigo: t.codigo,
      designacao: t.nome,
    })),
    formandos: body.formandos.map((f) => ({
      nif: requireNif(f.nif, "000000000"),
      nome: f.nome,
      email: f.email ?? null,
      telefone: f.telefone ?? null,
      codigoTurma: f.turmaCodigo ?? null,
      matriculaExternaId: f.matriculaId ?? null,
      taxaAssiduidadePercent: f.assiduidade?.taxaPresencaPercent ?? null,
    })),
    planoSessoes: (body.planoFormativo ?? []).map((s) => ({
      ordem: s.numeroSessao,
      data: s.data,
      horaInicio: s.horaInicio ?? null,
      horaFim: s.horaFim ?? null,
      modalidade: s.modalidade ?? null,
      estado: s.estado ?? null,
      formadorNif: s.formador?.nif ?? null,
    })),
    metadados: {
      pacoteNexiforma: SIGO_EXPORT_SCHEMA,
    },
  };
}

export type SigoSubmitPayloadFormat = "nexiforma" | "dgeec" | "dual";

/** Escolhe o corpo HTTP a enviar à API SIGO conforme configuração. */
export function buildSigoSubmitHttpBody(
  nexiformaBody: NexiformaSigoExportBody,
  referenciaExterna: string,
  format: SigoSubmitPayloadFormat = "dgeec",
): Record<string, unknown> {
  const dgeec = mapNexiformaToDgeecPayload(nexiformaBody, referenciaExterna);
  if (format === "nexiforma") {
    return { ...nexiformaBody, referenciaExterna };
  }
  if (format === "dual") {
    return {
      referenciaExterna,
      dgeec,
      nexiforma: nexiformaBody,
    };
  }
  return dgeec as unknown as Record<string, unknown>;
}
