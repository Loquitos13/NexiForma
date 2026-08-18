/** Regiões SIGO / portais ministeriais (Continente, RAM, RAA). */
export type SigoRegiaoPortal = "CONTINENTE" | "MADEIRA" | "ACORES";

export const SIGO_PORTAIS_URL: Record<SigoRegiaoPortal, string> = {
  CONTINENTE: "https://sigo.gov.pt",
  MADEIRA: "https://sigoram.gov.pt",
  ACORES: "https://sigoraa.gov.pt",
};

/** Estados da acção alinhados com fluxo SIGO/DGEEC. */
export const SIGO_ESTADOS_ACAO = {
  PLANEADA: "PLANEADA",
  A_DECORRER: "A_DECORRER",
  CONCLUIDA: "CONCLUIDA",
} as const;

export type SigoEstadoAcao = (typeof SIGO_ESTADOS_ACAO)[keyof typeof SIGO_ESTADOS_ACAO];

/** Mapeia estado interno NexiForma → estado SIGO. */
export function mapAcaoEstadoToSigo(
  estado: "PLANEADA" | "EM_CURSO" | "CONCLUIDA" | "CANCELADA",
): SigoEstadoAcao | null {
  switch (estado) {
    case "PLANEADA":
      return SIGO_ESTADOS_ACAO.PLANEADA;
    case "EM_CURSO":
      return SIGO_ESTADOS_ACAO.A_DECORRER;
    case "CONCLUIDA":
      return SIGO_ESTADOS_ACAO.CONCLUIDA;
    default:
      return null;
  }
}

/** Tipos de documento de identificação SIGO (CC, passaporte, …). */
export const SIGO_TIPOS_DOC_IDENTIFICACAO = ["C", "P", "BI", "OUTRO"] as const;
export type SigoTipoDocIdentificacao = (typeof SIGO_TIPOS_DOC_IDENTIFICACAO)[number];

/**
 * Níveis do Quadro Nacional de Qualificações (QNQ / DGES), usados em SIGO.
 * @see https://www.dges.gov.pt/pt/quadro_qualificacoes
 * Nível 5 (CTeSP) omitido até ser pedido na UI.
 */
export const SIGO_HABILITACOES_QNQ = [
  { codigo: "1", label: "2.º ciclo (5.º-6.º ano) - Nível 1" },
  { codigo: "2", label: "3.º ciclo (7.º-9.º ano) - Nível 2" },
  { codigo: "3", label: "Ensino secundário (10.º-12.º ano) - Nível 3" },
  { codigo: "4", label: "Curso profissional / dupla certificação - Nível 4" },
  { codigo: "6", label: "Licenciatura - Nível 6" },
  { codigo: "7", label: "Mestrado - Nível 7" },
  { codigo: "8", label: "Doutoramento - Nível 8" },
] as const;

/** Códigos QNQ válidos (compatível com validação SIGO / DTO). */
export const SIGO_HABILITACOES_CNQ = ["1", "2", "3", "4", "6", "7", "8"] as const;

export type SigoHabilitacaoLiteraria = (typeof SIGO_HABILITACOES_CNQ)[number];

/**
 * Converte códigos antigos (anos de escolaridade 1–12) para nível QNQ.
 * Códigos já QNQ passam intactos; desconhecidos devolvem null.
 */
export function normalizarHabilitacaoQnq(code?: string | null): SigoHabilitacaoLiteraria | null {
  const c = (code ?? "").trim();
  if (!c) return null;
  if ((SIGO_HABILITACOES_CNQ as readonly string[]).includes(c)) {
    return c as SigoHabilitacaoLiteraria;
  }
  const n = Number.parseInt(c, 10);
  if (!Number.isFinite(n)) return null;
  if (n >= 5 && n <= 6) return "1";
  if (n >= 7 && n <= 9) return "2";
  if (n >= 10 && n <= 12) return "3";
  return null;
}

export function labelHabilitacaoQnq(code?: string | null): string {
  const norm = normalizarHabilitacaoQnq(code) ?? (code ?? "").trim();
  const hit = SIGO_HABILITACOES_QNQ.find((h) => h.codigo === norm);
  return hit?.label ?? (norm ? `Nível ${norm}` : "-");
}

/** Metadados SIGO guardados em `FormandoProfile.metadata.sigo`. */
export type SigoFormandoMetadata = {
  tipoDocIdentificacao?: SigoTipoDocIdentificacao | string;
  numDocIdentificacao?: string;
  validadeDocumento?: string;
  codPaisDocIdentificacao?: string;
  dataNascimento?: string;
  nacionalidade?: string;
  habilitacaoLiteraria?: string;
};

/** Mensagens amigáveis para SOAP Faults conhecidos do SIGO. */
export const SIGO_SOAP_FAULT_MESSAGES: Record<string, string> = {
  "soap:Client": "Pedido inválido – verifique os dados enviados.",
  "soap:Server": "Erro no servidor SIGO – tente mais tarde ou contacte a DGEEC.",
  NIF_INVALIDO: "NIF inválido ou não reconhecido pelo SIGO.",
  FORMANDO_DUPLICADO: "Formando já inscrito noutra acção sobreposta.",
  FORMANDO_JA_INSCRITO: "Formando já inscrito nesta ou noutra acção.",
  UFCD_INVALIDO: "Código UFCD não existe no Catálogo Nacional de Qualificações.",
  ENTIDADE_NAO_AUTORIZADA: "Entidade não autorizada ou IP não whitelisted.",
  CREDENCIAIS_INVALIDAS: "Credenciais SOAP inválidas (UsernameToken).",
};

export function traduzirSigoSoapFault(code: string | null, faultString: string | null): string {
  if (!code && !faultString) return "Erro desconhecido na comunicação SOAP com o SIGO.";
  const norm = (code ?? "").trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_");
  if (SIGO_SOAP_FAULT_MESSAGES[norm]) return SIGO_SOAP_FAULT_MESSAGES[norm];
  const lower = (faultString ?? "").toLowerCase();
  if (lower.includes("nif")) return SIGO_SOAP_FAULT_MESSAGES.NIF_INVALIDO;
  if (lower.includes("inscrit") || lower.includes("sobrepost"))
    return SIGO_SOAP_FAULT_MESSAGES.FORMANDO_JA_INSCRITO;
  if (lower.includes("ufcd") || lower.includes("cnq")) return SIGO_SOAP_FAULT_MESSAGES.UFCD_INVALIDO;
  if (lower.includes("ip") || lower.includes("autoriz"))
    return SIGO_SOAP_FAULT_MESSAGES.ENTIDADE_NAO_AUTORIZADA;
  return faultString?.trim() || `Erro SIGO (${code ?? "SOAP-FAULT"}).`;
}

export type SigoProtocolo = "soap" | "http";
