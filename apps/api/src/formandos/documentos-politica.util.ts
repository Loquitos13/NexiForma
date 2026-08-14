import {
  FORMANDO_DOC_TIPOS,
  type FormandoDocObrigatorioId,
} from "./formando-documentos.util";
import {
  isMatriculaDocCategoria,
  MATRICULA_DOC_CATEGORIAS,
  type MatriculaDocCategoria,
} from "./matricula-documentos.util";

/** Opções universais que o tenant pode marcar como obrigatórias. */
export const UNIVERSAL_DOC_OPTIONS: Array<{
  id: FormandoDocObrigatorioId;
  label: string;
  ajuda: string;
}> = [
  {
    id: "cv",
    label: "Curriculum Vitae",
    ajuda: "Reutilizável em todos os cursos.",
  },
  {
    id: "documento_identificacao",
    label: "Documento de Identificação",
    ajuda: "Comprova identidade/nacionalidade.",
  },
  {
    id: "certificado_habilitacoes",
    label: "Certificado de habilitações português",
    ajuda:
      "Habilitações literárias; no ensino superior, use a certidão de conclusão de grau.",
  },
  {
    id: "declaracao_entidade_patronal",
    label: "Declaração da entidade patronal",
    ajuda: "Declaração assinada pela entidade patronal.",
  },
  {
    id: "certidao_grau",
    label: "Certidão de conclusão de grau",
    ajuda: "Ensino superior (quando aplicável).",
  },
  {
    id: "comprovativo_iban",
    label: "Declaração de IBAN",
    ajuda: "Declaração ou comprovativo bancário com IBAN.",
  },
  {
    id: "domicilio_fiscal",
    label: "Comprovativo de morada",
    ajuda: "Comprovativo de morada.",
  },
];

export const ENROLLMENT_DOC_OPTIONS: Array<{
  id: MatriculaDocCategoria;
  label: string;
  ajuda: string;
}> = [
  {
    id: "declaracao_inscricao",
    label: "Declaração de inscrição",
    ajuda: "Específica desta edição (dados do curso/acção).",
  },
  {
    id: "contrato_formacao",
    label: "Contrato de formação",
    ajuda: "Horas, valor e condições desta edição - template por acção.",
  },
  {
    id: "regulamento_formacao",
    label: "Regulamento de formação",
    ajuda: "Aceite digital pelo formando (modelo por acção).",
  },
];

export const DEFAULT_UNIVERSAL_REQUIRED: FormandoDocObrigatorioId[] = [
  "documento_identificacao",
  "certificado_habilitacoes",
  "declaracao_entidade_patronal",
  "domicilio_fiscal",
  "comprovativo_iban",
];

export const DEFAULT_ENROLLMENT_REQUIRED: MatriculaDocCategoria[] = [
  "declaracao_inscricao",
  "contrato_formacao",
  "regulamento_formacao",
];

export type DocumentosPoliticaTenant = {
  version: 1;
  universaisObrigatorios: FormandoDocObrigatorioId[];
};

/** Config por curso (predefinição) ou por acção (snapshot operacional). */
export type ConfiguracaoMatriculaDocs = {
  version: 1;
  /** Se definido, sobrepõe a política do tenant para esta edição/curso. */
  universaisObrigatorios?: FormandoDocObrigatorioId[];
  /** Docs de inscrição exigidos nesta edição (contrato, declaração, …). */
  inscricaoObrigatorios: MatriculaDocCategoria[];
  /** Notas internas (ex.: «preencher valor e horas no contrato»). */
  notas?: string;
  /** Conteúdo HTML editável por categoria (gera PDF do template da acção). */
  templatesConteudo?: Partial<Record<MatriculaDocCategoria, string>>;
};

export type DocumentosPoliticaResolvida = {
  universaisObrigatorios: FormandoDocObrigatorioId[];
  inscricaoObrigatorios: MatriculaDocCategoria[];
  notas: string | null;
  origemUniversais: "acao" | "curso" | "tenant" | "default";
  origemInscricao: "acao" | "curso" | "default";
};

const UNIVERSAL_IDS = new Set(UNIVERSAL_DOC_OPTIONS.map((o) => o.id));

function asRecord(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  return v as Record<string, unknown>;
}

function filterUniversais(raw: unknown): FormandoDocObrigatorioId[] | null {
  if (!Array.isArray(raw)) return null;
  const out: FormandoDocObrigatorioId[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    if (UNIVERSAL_IDS.has(item as FormandoDocObrigatorioId)) {
      out.push(item as FormandoDocObrigatorioId);
    } else if (FORMANDO_DOC_TIPOS.has(item) && item === "cc") {
      // legado CC conta como identificação - mapear
      if (!out.includes("documento_identificacao")) out.push("documento_identificacao");
    }
  }
  return out;
}

function filterInscricao(raw: unknown): MatriculaDocCategoria[] | null {
  if (!Array.isArray(raw)) return null;
  const out: MatriculaDocCategoria[] = [];
  for (const item of raw) {
    if (typeof item === "string" && isMatriculaDocCategoria(item) && !out.includes(item)) {
      out.push(item);
    }
  }
  return out;
}

export function parseTenantDocumentosPolitica(metadata: unknown): DocumentosPoliticaTenant {
  const meta = asRecord(metadata);
  const bloco = asRecord(meta?.documentosPolitica);
  const universais =
    filterUniversais(bloco?.universaisObrigatorios) ?? [...DEFAULT_UNIVERSAL_REQUIRED];
  return { version: 1, universaisObrigatorios: universais };
}

function parseTemplatesConteudo(
  raw: unknown,
): Partial<Record<MatriculaDocCategoria, string>> | undefined {
  const obj = asRecord(raw);
  if (!obj) return undefined;
  const out: Partial<Record<MatriculaDocCategoria, string>> = {};
  for (const cat of MATRICULA_DOC_CATEGORIAS) {
    const v = obj[cat];
    if (typeof v === "string" && v.trim()) out[cat] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

export function parseConfiguracaoMatriculaDocs(raw: unknown): ConfiguracaoMatriculaDocs | null {
  const obj = asRecord(raw);
  if (!obj) return null;
  const inscricao =
    filterInscricao(obj.inscricaoObrigatorios) ??
    filterInscricao(obj.enrollmentRequired);
  if (!inscricao) return null;
  const universais = filterUniversais(obj.universaisObrigatorios);
  const notas = typeof obj.notas === "string" ? obj.notas.trim() : "";
  const templatesConteudo = parseTemplatesConteudo(obj.templatesConteudo);
  return {
    version: 1,
    ...(universais ? { universaisObrigatorios: universais } : {}),
    inscricaoObrigatorios: inscricao,
    ...(notas ? { notas } : {}),
    ...(templatesConteudo ? { templatesConteudo } : {}),
  };
}

export function normalizeConfiguracaoMatriculaDocs(
  input: Partial<ConfiguracaoMatriculaDocs> | null | undefined,
): ConfiguracaoMatriculaDocs {
  const inscricao =
    filterInscricao(input?.inscricaoObrigatorios) ?? [...DEFAULT_ENROLLMENT_REQUIRED];
  const universais = filterUniversais(input?.universaisObrigatorios ?? undefined);
  const notas = input?.notas?.trim() || undefined;
  const templatesConteudo = parseTemplatesConteudo(input?.templatesConteudo);
  return {
    version: 1,
    ...(universais ? { universaisObrigatorios: universais } : {}),
    inscricaoObrigatorios: inscricao,
    ...(notas ? { notas } : {}),
    ...(templatesConteudo ? { templatesConteudo } : {}),
  };
}

export function resolveDocumentosPolitica(opts: {
  tenantMetadata: unknown;
  cursoConfig?: unknown;
  acaoConfig?: unknown;
}): DocumentosPoliticaResolvida {
  const tenant = parseTenantDocumentosPolitica(opts.tenantMetadata);
  const curso = parseConfiguracaoMatriculaDocs(opts.cursoConfig);
  const acao = parseConfiguracaoMatriculaDocs(opts.acaoConfig);

  let universais = tenant.universaisObrigatorios;
  let origemUniversais: DocumentosPoliticaResolvida["origemUniversais"] = "tenant";
  if (curso?.universaisObrigatorios) {
    universais = curso.universaisObrigatorios;
    origemUniversais = "curso";
  }
  if (acao?.universaisObrigatorios) {
    universais = acao.universaisObrigatorios;
    origemUniversais = "acao";
  }
  if (
    origemUniversais === "tenant" &&
    !asRecord(asRecord(opts.tenantMetadata)?.documentosPolitica)
  ) {
    origemUniversais = "default";
  }

  let inscricao = [...DEFAULT_ENROLLMENT_REQUIRED];
  let origemInscricao: DocumentosPoliticaResolvida["origemInscricao"] = "default";
  if (curso) {
    inscricao = curso.inscricaoObrigatorios;
    origemInscricao = "curso";
  }
  if (acao) {
    inscricao = acao.inscricaoObrigatorios;
    origemInscricao = "acao";
  }

  const notas = acao?.notas ?? curso?.notas ?? null;

  return {
    universaisObrigatorios: universais,
    inscricaoObrigatorios: inscricao.length ? inscricao : [...DEFAULT_ENROLLMENT_REQUIRED],
    notas,
    origemUniversais,
    origemInscricao,
  };
}

export function mergeTenantDocumentosPolitica(
  metadata: unknown,
  politica: DocumentosPoliticaTenant,
): Record<string, unknown> {
  const meta = asRecord(metadata) ?? {};
  return {
    ...meta,
    documentosPolitica: {
      version: 1,
      universaisObrigatorios: politica.universaisObrigatorios,
    },
  };
}

export { MATRICULA_DOC_CATEGORIAS };
