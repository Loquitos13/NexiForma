export type FormadorDocObrigatorioId =
  | "cv"
  | "documento_identificacao"
  | "ccp"
  | "ficha_dgert"
  | "certificados_formacao"
  | "carta_conducao";

export type FormadorDocObrigatorioItem = {
  id: FormadorDocObrigatorioId;
  label: string;
  completo: boolean;
  detalhe: string;
  origem: "universal" | "cargo" | "opcional";
  obrigatorio: boolean;
};

export type FormadorDocObrigatorioResumo = {
  items: FormadorDocObrigatorioItem[];
  completo: boolean;
  emFalta: FormadorDocObrigatorioId[];
  totalDocumentos: number;
};

export const FORMADOR_DOCS_OBRIGATORIOS_META: Array<{
  id: FormadorDocObrigatorioId;
  label: string;
  accept: string;
  ajuda: string;
}> = [
  {
    id: "cv",
    label: "Curriculum Vitae",
    accept: "application/pdf,image/jpeg,image/png",
    ajuda: "Currículo actualizado (PDF ou imagem).",
  },
  {
    id: "documento_identificacao",
    label: "Documento de Identificação",
    accept: "application/pdf,image/jpeg,image/png",
    ajuda: "Cópia do cartão de cidadão ou documento equivalente.",
  },
  {
    id: "ccp",
    label: "CCP",
    accept: "application/pdf,image/jpeg,image/png",
    ajuda: "Certificado de Competências Pedagógicas (obrigatório do cargo).",
  },
  {
    id: "ficha_dgert",
    label: "Ficha Curricular DGERT",
    accept: "application/pdf,image/jpeg,image/png",
    ajuda: "Ficha curricular DGERT preenchida e assinada.",
  },
  {
    id: "certificados_formacao",
    label: "Certificados de formação complementar",
    accept: "application/pdf,image/jpeg,image/png",
    ajuda: "Certificados de formação complementar (quando existirem).",
  },
  {
    id: "carta_conducao",
    label: "Carta de condução",
    accept: "application/pdf,image/jpeg,image/png",
    ajuda: "Carta de condução (quando aplicável).",
  },
];

export const FORMADOR_DOC_CATEGORIAS_UPLOAD = [
  { value: "documento_identificacao", label: "Documento de Identificação" },
  { value: "ccp", label: "CCP" },
  { value: "cv", label: "Curriculum Vitae" },
  { value: "certificados_formacao", label: "Certificados de formação complementar (se existir)" },
  { value: "ficha_dgert", label: "Ficha Curricular DGERT" },
  { value: "carta_conducao", label: "Carta de condução" },
  { value: "outros", label: "Outros documentos relevantes" },
] as const;

export function labelFormadorDocCategoria(categoria: string | null | undefined): string {
  const meta = FORMADOR_DOCS_OBRIGATORIOS_META.find((m) => m.id === categoria);
  if (meta) return meta.label;
  const cat = FORMADOR_DOC_CATEGORIAS_UPLOAD.find((c) => c.value === categoria);
  if (cat) return cat.label;
  if (!categoria) return "Documento";
  return categoria;
}
