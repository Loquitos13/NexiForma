/** Categorias de documentos do formador (credenciais DGERT / CV). */
export const FORMADOR_DOC_TIPOS = new Set([
  "documento_identificacao",
  "cc",
  "ccp",
  "cv",
  "carta_conducao",
  "certificados_formacao",
  "ficha_dgert",
  "outros",
]);

export const FORMADOR_DOC_MIMES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "application/pdf",
]);

export const FORMADOR_DOC_MAX_BYTES = 10 * 1024 * 1024;

export const FORMADOR_DOC_LABELS: Record<string, string> = {
  documento_identificacao: "Cartão de Cidadão",
  cc: "Cartão de Cidadão",
  ccp: "CCP (Certificado de Competências Pedagógicas)",
  cv: "Curriculum Vitae",
  carta_conducao: "Carta de condução",
  certificados_formacao: "Certificados de formação complementar",
  ficha_dgert: "Ficha Curricular DGERT",
  outros: "Outros documentos",
};

/** Universais do tenant que o formador consegue carregar (categorias partilhadas). */
export const FORMADOR_UNIVERSAL_COMPAT = new Set(["cv", "documento_identificacao"]);

/** Obrigatórios do cargo formador (além dos universais compatíveis). */
export const FORMADOR_ROLE_REQUIRED = ["ccp", "ficha_dgert"] as const;

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

const OBRIGATORIO_META: Record<
  FormadorDocObrigatorioId,
  { label: string; detalheFalta: string; origem: "universal" | "cargo" | "opcional" }
> = {
  cv: {
    label: "Curriculum Vitae",
    detalheFalta: "PDF ou imagem obrigatório",
    origem: "universal",
  },
  documento_identificacao: {
    label: "Cartão de Cidadão",
    detalheFalta: "Cópia do cartão de cidadão (PDF ou imagem)",
    origem: "universal",
  },
  ccp: {
    label: "CCP",
    detalheFalta: "Certificado de Competências Pedagógicas (obrigatório do cargo)",
    origem: "cargo",
  },
  ficha_dgert: {
    label: "Ficha Curricular DGERT",
    detalheFalta: "Ficha curricular DGERT preenchida e assinada (PDF ou imagem)",
    origem: "cargo",
  },
  certificados_formacao: {
    label: "Certificados de formação complementar",
    detalheFalta: "Certificados de formação complementar (quando existirem)",
    origem: "opcional",
  },
  carta_conducao: {
    label: "Carta de condução",
    detalheFalta: "Carta de condução (quando aplicável)",
    origem: "opcional",
  },
};

export function labelFormadorDocCategoria(categoria: string | null | undefined): string {
  if (!categoria) return "Documento";
  return FORMADOR_DOC_LABELS[categoria] ?? categoria;
}

/**
 * Universais do tenant aplicáveis ao formador + documentos do cargo.
 * Se o tenant não marcar nenhum universal compatível, usa CV + identificação.
 */
export function resolveFormadorObrigatorios(
  tenantUniversais?: string[] | null,
): FormadorDocObrigatorioId[] {
  const fromTenant = (tenantUniversais ?? []).filter(
    (id): id is "cv" | "documento_identificacao" => FORMADOR_UNIVERSAL_COMPAT.has(id),
  );
  const universais: FormadorDocObrigatorioId[] =
    fromTenant.length > 0 ? fromTenant : ["cv", "documento_identificacao"];
  return [...new Set<FormadorDocObrigatorioId>([...universais, ...FORMADOR_ROLE_REQUIRED])];
}

export function avaliarDocumentosObrigatoriosFormador(
  docs: Array<{ categoria: string | null }>,
  tenantUniversais?: string[] | null,
): {
  items: FormadorDocObrigatorioItem[];
  completo: boolean;
  emFalta: FormadorDocObrigatorioId[];
  totalDocumentos: number;
} {
  const required = resolveFormadorObrigatorios(tenantUniversais);
  const requiredSet = new Set(required);
  const categorias = new Set(
    docs.map((d) => d.categoria).filter((c): c is string => Boolean(c)),
  );

  const allIds = Object.keys(OBRIGATORIO_META) as FormadorDocObrigatorioId[];

  const items: FormadorDocObrigatorioItem[] = allIds.map((id) => {
    const meta = OBRIGATORIO_META[id];
    const ok = categorias.has(id);
    const isRequired = requiredSet.has(id);
    return {
      id,
      label: meta.label,
      completo: ok,
      detalhe: ok ? "Ficheiro registado" : meta.detalheFalta,
      origem: meta.origem,
      obrigatorio: isRequired,
    };
  });

  const emFalta = items.filter((i) => i.obrigatorio && !i.completo).map((i) => i.id);
  return {
    items,
    completo: emFalta.length === 0,
    emFalta,
    totalDocumentos: docs.length,
  };
}
