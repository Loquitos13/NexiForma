export type DocObrigatorioId =
  | "cv"
  | "certificado_habilitacoes"
  | "documento_identificacao"
  | "declaracao_entidade_patronal"
  | "certidao_grau"
  | "domicilio_fiscal"
  | "comprovativo_iban";

export type DocObrigatorioItem = {
  id: DocObrigatorioId;
  label: string;
  completo: boolean;
  detalhe: string;
};

export type DocObrigatorioResumo = {
  items: DocObrigatorioItem[];
  completo: boolean;
  emFalta: DocObrigatorioId[];
};

/** Documentos universais do formando (reutilizados em todos os cursos). */
export const DOCS_OBRIGATORIOS_META: Array<{
  id: DocObrigatorioId;
  label: string;
  accept: string;
  ajuda: string;
  lados: Array<"unico" | "frente" | "verso">;
}> = [
  {
    id: "documento_identificacao",
    label: "Documento de Identificação",
    accept: "application/pdf,image/jpeg,image/png",
    ajuda: "PDF único com frente e verso, ou dois ficheiros. Comprova a identidade.",
    lados: ["unico", "frente", "verso"],
  },
  {
    id: "certificado_habilitacoes",
    label: "Certificado de habilitações português",
    accept: "application/pdf,image/jpeg,image/png",
    ajuda:
      "Certificado de habilitações literárias; no ensino superior, a certidão de conclusão de grau.",
    lados: ["unico"],
  },
  {
    id: "declaracao_entidade_patronal",
    label: "Declaração da entidade patronal",
    accept: "application/pdf,image/jpeg,image/png",
    ajuda: "Declaração assinada pela entidade patronal (PDF ou imagem).",
    lados: ["unico"],
  },
  {
    id: "domicilio_fiscal",
    label: "Comprovativo de morada",
    accept: "application/pdf,image/jpeg,image/png",
    ajuda: "Comprovativo de morada (PDF ou imagem).",
    lados: ["unico"],
  },
  {
    id: "comprovativo_iban",
    label: "Declaração de IBAN",
    accept: "application/pdf,image/jpeg,image/png",
    ajuda: "Declaração ou comprovativo bancário com IBAN (PDF ou imagem).",
    lados: ["unico"],
  },
  {
    id: "cv",
    label: "Curriculum Vitae",
    accept: "application/pdf,image/jpeg,image/png",
    ajuda: "CV em PDF - fica na tua ficha e serve para todos os cursos.",
    lados: ["unico"],
  },
  {
    id: "certidao_grau",
    label: "Certidão de conclusão de grau",
    accept: "application/pdf,image/jpeg,image/png",
    ajuda: "Certidão de conclusão de grau de ensino superior (quando aplicável).",
    lados: ["unico"],
  },
];

export const FORMANDO_DOC_CATEGORIAS_UPLOAD = [
  { value: "documento_identificacao", label: "Documento de Identificação" },
  { value: "certificado_habilitacoes", label: "Certificado de habilitações português" },
  { value: "declaracao_entidade_patronal", label: "Declaração da entidade patronal" },
  { value: "domicilio_fiscal", label: "Comprovativo de morada" },
  { value: "comprovativo_iban", label: "Declaração de IBAN" },
  { value: "cv", label: "Curriculum Vitae" },
  { value: "certidao_grau", label: "Certidão de conclusão de grau" },
  { value: "outros", label: "Ficheiros adicionais" },
] as const;

export function labelDocCategoria(categoria: string, lado?: string | null): string {
  const meta = DOCS_OBRIGATORIOS_META.find((m) => m.id === categoria);
  const base =
    meta?.label ??
    ({
      cc: "Cartão de Cidadão",
      bi: "Bilhete de Identidade",
      carta_conducao: "Carta de Condução",
      outros: "Ficheiros adicionais",
      outro: "Outro documento",
    }[categoria] ?? categoria);
  if (lado === "verso") return `${base} - verso`;
  if (lado === "frente" && (categoria === "cc" || categoria === "documento_identificacao")) {
    return `${base} - frente`;
  }
  if (lado === "unico") return `${base} (PDF/ficheiro único)`;
  return base;
}
