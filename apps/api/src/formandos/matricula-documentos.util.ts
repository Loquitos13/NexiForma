/** Documentos exigidos por inscrição (ação/turma), à la Training House. */
export const MATRICULA_DOC_CATEGORIAS = [
  "declaracao_inscricao",
  "contrato_formacao",
  "regulamento_formacao",
] as const;

export type MatriculaDocCategoria = (typeof MATRICULA_DOC_CATEGORIAS)[number];

/** Templates na ação de formação (download pelo formando). */
export const ACAO_TEMPLATE_CATEGORIAS: Record<MatriculaDocCategoria, string> = {
  declaracao_inscricao: "template_declaracao_inscricao",
  contrato_formacao: "template_contrato_formacao",
  regulamento_formacao: "template_regulamento_formacao",
};

export const MATRICULA_DOC_LABELS: Record<MatriculaDocCategoria, string> = {
  declaracao_inscricao: "Declaração de inscrição",
  contrato_formacao: "Contrato de formação",
  regulamento_formacao: "Regulamento de formação",
};

export type MatriculaDocEstado = "pendente" | "enviado" | "aceite";

export function isMatriculaDocCategoria(v: string): v is MatriculaDocCategoria {
  return (MATRICULA_DOC_CATEGORIAS as readonly string[]).includes(v);
}

export function labelMatriculaDoc(categoria: string): string {
  if (isMatriculaDocCategoria(categoria)) return MATRICULA_DOC_LABELS[categoria];
  return categoria;
}

/** Dados para createMany do checklist documental de uma inscrição. */
export function matriculaDocumentosSeedRows(
  tenantId: string,
  matriculaId: string,
  categorias: readonly MatriculaDocCategoria[] = MATRICULA_DOC_CATEGORIAS,
) {
  const unique = [...new Set(categorias)];
  return unique.map((categoria) => ({
    tenantId,
    matriculaId,
    categoria,
    estado: "pendente" as const,
  }));
}
