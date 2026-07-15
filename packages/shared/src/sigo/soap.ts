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
 * Códigos de habilitações literárias CNQ/SIGO (anos de escolaridade concluídos).
 * Expandir conforme tabela oficial DGEEC.
 */
export const SIGO_HABILITACOES_CNQ = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
  "13",
  "14",
  "15",
  "16",
  "17",
  "18",
  "19",
  "20",
  "21",
  "22",
  "23",
] as const;

export type SigoHabilitacaoLiteraria = (typeof SIGO_HABILITACOES_CNQ)[number];

/** Metadados SIGO guardados em `FormandoProfile.metadata.sigo`. */
export type SigoFormandoMetadata = {
  tipoDocIdentificacao?: SigoTipoDocIdentificacao | string;
  numDocIdentificacao?: string;
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
