export type DocObrigatorioId =
  | "cv"
  | "certificado_habilitacoes"
  | "documento_identificacao"
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
    label: "Cópia do Cartão de Cidadão",
    accept: "application/pdf,image/jpeg,image/png",
    ajuda: "PDF único com frente e verso, ou dois ficheiros. Comprova a identidade.",
    lados: ["unico", "frente", "verso"],
  },
  {
    id: "certificado_habilitacoes",
    label: "Certificado de habilitações",
    accept: "application/pdf,image/jpeg,image/png",
    ajuda:
      "Certificado de habilitações literárias; no ensino superior, a certidão de conclusão de grau.",
    lados: ["unico"],
  },
  {
    id: "comprovativo_iban",
    label: "Comprovativo de IBAN",
    accept: "application/pdf,image/jpeg,image/png",
    ajuda: "Comprovativo bancário com IBAN (PDF ou imagem).",
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
  {
    id: "domicilio_fiscal",
    label: "Documento de domicílio fiscal",
    accept: "application/pdf,image/jpeg,image/png",
    ajuda: "Comprovativo de morada fiscal (PDF ou imagem).",
    lados: ["unico"],
  },
];

export function labelDocCategoria(categoria: string, lado?: string | null): string {
  const meta = DOCS_OBRIGATORIOS_META.find((m) => m.id === categoria);
  const base =
    meta?.label ??
    ({
      cc: "Cartão de Cidadão",
      bi: "Bilhete de Identidade",
      carta_conducao: "Carta de Condução",
      outros: "Outros documentos",
      outro: "Outro documento",
    }[categoria] ?? categoria);
  if (lado === "verso") return `${base} - verso`;
  if (lado === "frente" && (categoria === "cc" || categoria === "documento_identificacao")) {
    return `${base} - frente`;
  }
  if (lado === "unico") return `${base} (PDF/ficheiro único)`;
  return base;
}
