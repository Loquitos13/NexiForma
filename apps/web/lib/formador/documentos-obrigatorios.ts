export type FormadorDocObrigatorioId =
  | "cv"
  | "documento_identificacao"
  | "ccp"
  | "certificados_formacao"
  | "ficha_dgert";

export type FormadorDocObrigatorioItem = {
  id: FormadorDocObrigatorioId;
  label: string;
  completo: boolean;
  detalhe: string;
  origem: "universal" | "cargo";
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
    label: "Cartão de Cidadão",
    accept: "application/pdf,image/jpeg,image/png",
    ajuda: "Cópia do cartão de cidadão.",
  },
  {
    id: "ccp",
    label: "Cópia do CCP",
    accept: "application/pdf,image/jpeg,image/png",
    ajuda: "Certificado de Competências Pedagógicas (obrigatório do cargo).",
  },
  {
    id: "certificados_formacao",
    label: "Certificados das formações",
    accept: "application/pdf,image/jpeg,image/png",
    ajuda: "Certificados das formações que possui (pode juntar num único PDF).",
  },
  {
    id: "ficha_dgert",
    label: "Ficha DGERT preenchida e assinada",
    accept: "application/pdf,image/jpeg,image/png",
    ajuda: "Ficha da DGERT preenchida e assinada.",
  },
];

export const FORMADOR_DOC_CATEGORIAS_UPLOAD = [
  { value: "documento_identificacao", label: "Cartão de Cidadão" },
  { value: "ccp", label: "CCP" },
  { value: "cv", label: "Curriculum Vitae" },
  { value: "certificados_formacao", label: "Certificados das formações" },
  { value: "ficha_dgert", label: "Ficha DGERT preenchida e assinada" },
  { value: "carta_conducao", label: "Carta de condução" },
  { value: "outros", label: "Outros documentos" },
] as const;
