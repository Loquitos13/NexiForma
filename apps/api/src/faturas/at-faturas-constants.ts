/** Webservice e-Fatura – manual AT v3.0 (Out/2025). */
export const AT_DOCUMENTS_NS = "http://factemi.at.min_financas.pt/documents";

/** Namespace legado (respostas antigas / compat). */
export const AT_FATURAS_NS = "https://servicos.portaldasfinancas.gov.pt/faturas/";

export const AT_SOAP_ENVELOPE_NS = "http://schemas.xmlsoap.org/soap/envelope/";

export const AT_WSSE_NS = "http://schemas.xmlsoap.org/ws/2002/12/secext";

export const AT_SOAP_ACTION_REGISTER = `${AT_DOCUMENTS_NS}/RegisterInvoiceRequest`;

export const AT_SOAP_ACTION_CHANGE_STATUS = `${AT_DOCUMENTS_NS}/ChangeInvoiceStatusRequest`;

export const AT_EFATURA_MD_VERSION_DEFAULT = "0.0.1";

export const AT_AUDIT_FILE_VERSION_DEFAULT = "1.04_01";

export const AT_FATURAS_ENDPOINTS = {
  production: "https://servicos.portaldasfinancas.gov.pt:400/fews/faturas",
  sandbox: "https://servicos.portaldasfinancas.gov.pt:700/fews/faturas",
} as const;

export const AT_RETURN_CODE_MESSAGES: Record<string, string> = {
  "0": "Documento registado com sucesso.",
  "1": "Utilizador não preenchido.",
  "2": "Tamanho do utilizador incorreto.",
  "3": "NIF inválido.",
  "4": "Utilizador com formato inválido.",
  "5": "Subutilizador com formato inválido.",
  "6": "Senha não preenchida.",
  "7": "Codificação Base64 inválida.",
  "8": "Cifra da chave pública inválida.",
  "9": "Formato do Timestamp inválido.",
  "10": "Validade da credencial expirada.",
  "11": "Chave simétrica inválida.",
  "12": "Chave simétrica repetida.",
  "13": "Estrutura da senha inválida.",
  "99": "Erro na validação da senha.",
  "-1": "Parâmetros de entrada inválidos.",
  "-2": "Data de emissão inválida.",
  "-3": "Documento duplicado.",
  "-4": "Emitente sem permissões para este NIF.",
  "-6": "Estado de documento inválido.",
  "-7": "Documento inválido por valores anómalos.",
  "-8": "Código de motivo de isenção inválido.",
  "-10": "Documento já registado pelo emitente.",
  "-16": "Utilizador sem permissões para registar documentos.",
  "-17": "NIF inválido.",
  "-28": "Valores de entrada inválidos.",
  "-39": "Número de certificado inválido.",
  "-50": "Parâmetros de entrada obrigatórios em falta.",
  "-97": "Erro interno AT.",
  "-98": "Integridade ou multiplicidade dos parâmetros inválidos.",
  "-99": "Erro de sistema AT.",
};
