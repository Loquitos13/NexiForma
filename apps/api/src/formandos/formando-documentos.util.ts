/** Categorias de documentos do portal formando (universais - reutilizáveis em todos os cursos). */
import { DEFAULT_UNIVERSAL_REQUIRED } from "./documentos-politica.util";

export const FORMANDO_DOC_TIPOS = new Set([
  "cc",
  "bi",
  "carta_conducao",
  "cv",
  "certificado_habilitacoes",
  "certidao_grau",
  "documento_identificacao",
  "declaracao_entidade_patronal",
  "domicilio_fiscal",
  "comprovativo_iban",
  "outros",
]);

export const FORMANDO_DOC_LADOS = new Set(["frente", "verso", "unico"]);

export const FORMANDO_DOC_MIMES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "application/pdf",
]);

export const FORMANDO_DOC_MAX_BYTES = 10 * 1024 * 1024;

/** Tipos que exigem só um ficheiro (lado normalizado para `unico` ou `frente`). */
export const FORMANDO_DOC_SINGLE_FILE = new Set([
  "bi",
  "carta_conducao",
  "cv",
  "certificado_habilitacoes",
  "certidao_grau",
  "declaracao_entidade_patronal",
  "domicilio_fiscal",
  "comprovativo_iban",
  "outros",
]);

export type FormandoDocObrigatorioId =
  | "cv"
  | "certificado_habilitacoes"
  | "documento_identificacao"
  | "declaracao_entidade_patronal"
  | "certidao_grau"
  | "domicilio_fiscal"
  | "comprovativo_iban";

export type FormandoDocObrigatorioItem = {
  id: FormandoDocObrigatorioId;
  label: string;
  completo: boolean;
  detalhe: string;
  /** Se o tenant exige este documento na ficha universal. */
  obrigatorio: boolean;
};

export type FormandoDocRow = {
  categoria: string | null;
  lado: string | null;
};

/**
 * Identificação OK se:
 * - documento_identificacao com lado `unico`, ou frente+verso; ou
 * - CC legado com frente+verso.
 */
export function identificacaoCompleta(docs: FormandoDocRow[]): boolean {
  const idDocs = docs.filter((d) => d.categoria === "documento_identificacao");
  if (idDocs.some((d) => d.lado === "unico")) return true;
  const idLados = new Set(idDocs.map((d) => d.lado).filter(Boolean));
  if (idLados.has("frente") && idLados.has("verso")) return true;

  const ccLados = new Set(
    docs.filter((d) => d.categoria === "cc").map((d) => d.lado).filter(Boolean),
  );
  return ccLados.has("frente") && ccLados.has("verso");
}

export function temCategoria(docs: FormandoDocRow[], categoria: string): boolean {
  return docs.some((d) => d.categoria === categoria);
}

const OBRIGATORIO_META: Record<
  FormandoDocObrigatorioId,
  { label: string; detalheFalta: string }
> = {
  cv: {
    label: "Curriculum Vitae",
    detalheFalta: "PDF obrigatório (reutilizável em todos os cursos)",
  },
  documento_identificacao: {
    label: "Documento de Identificação",
    detalheFalta: "PDF único (frente+verso) ou frente e verso; comprova identidade",
  },
  certificado_habilitacoes: {
    label: "Certificado de habilitações português",
    detalheFalta:
      "Certificado de habilitações literárias (ou certidão de conclusão de grau, no ensino superior)",
  },
  declaracao_entidade_patronal: {
    label: "Declaração da entidade patronal",
    detalheFalta: "Declaração assinada pela entidade patronal (PDF ou imagem)",
  },
  certidao_grau: {
    label: "Certidão de conclusão de grau",
    detalheFalta: "Certidão de conclusão de grau de ensino superior (quando aplicável)",
  },
  domicilio_fiscal: {
    label: "Comprovativo de morada",
    detalheFalta: "Comprovativo de morada (PDF ou imagem)",
  },
  comprovativo_iban: {
    label: "Declaração de IBAN",
    detalheFalta: "Declaração ou comprovativo bancário com IBAN (PDF ou imagem)",
  },
};

export function avaliarDocumentosObrigatorios(
  docs: FormandoDocRow[],
  obrigatorios?: FormandoDocObrigatorioId[],
): {
  items: FormandoDocObrigatorioItem[];
  completo: boolean;
  emFalta: FormandoDocObrigatorioId[];
} {
  const required =
    obrigatorios && obrigatorios.length > 0 ? obrigatorios : [...DEFAULT_UNIVERSAL_REQUIRED];

  const requiredSet = new Set(required);

  const completoDe = (id: FormandoDocObrigatorioId): boolean => {
    if (id === "documento_identificacao") return identificacaoCompleta(docs);
    return temCategoria(docs, id);
  };

  const allIds = Object.keys(OBRIGATORIO_META) as FormandoDocObrigatorioId[];

  const items: FormandoDocObrigatorioItem[] = allIds.map((id) => {
    const meta = OBRIGATORIO_META[id];
    const ok = completoDe(id);
    const isRequired = requiredSet.has(id);
    return {
      id,
      label: meta.label,
      completo: ok,
      detalhe: ok ? "Ficheiro registado" : meta.detalheFalta,
      obrigatorio: isRequired,
    };
  });

  const emFalta = items.filter((i) => i.obrigatorio && !i.completo).map((i) => i.id);
  return { items, completo: emFalta.length === 0, emFalta };
}

export function normalizarLadoDocumento(categoria: string, lado?: string | null): string {
  const raw = (lado ?? "").trim() || "frente";
  if (!FORMANDO_DOC_LADOS.has(raw)) {
    throw new Error("Lado do documento inválido.");
  }
  if (categoria === "documento_identificacao") {
    return raw;
  }
  if (categoria === "cc") {
    if (raw === "unico") throw new Error("CC não aceita lado «unico» - use frente/verso.");
    return raw;
  }
  // restantes: um ficheiro
  return raw === "verso" ? "frente" : raw === "unico" ? "unico" : "frente";
}

export function labelCategoriaDocumento(categoria: string, lado?: string | null): string {
  const labels: Record<string, string> = {
    cc: "Cartão de Cidadão",
    bi: "Bilhete de Identidade",
    carta_conducao: "Carta de Condução",
    cv: "Curriculum Vitae",
    certificado_habilitacoes: "Certificado de habilitações português",
    certidao_grau: "Certidão de conclusão de grau",
    documento_identificacao: "Documento de Identificação",
    declaracao_entidade_patronal: "Declaração da entidade patronal",
    domicilio_fiscal: "Comprovativo de morada",
    comprovativo_iban: "Declaração de IBAN",
    outros: "Outros documentos",
    outro: "Outro documento",
  };
  const base = labels[categoria] ?? categoria;
  if (categoria === "cc" || categoria === "documento_identificacao") {
    if (lado === "verso") return `${base} - verso`;
    if (lado === "frente") return `${base} - frente`;
    if (lado === "unico") return `${base} (PDF único)`;
  }
  return base;
}
