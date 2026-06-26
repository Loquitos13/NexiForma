/** Webservice factemiws – especificação AT (RegisterInvoice). */
export const AT_FATURAS_NS = "https://servicos.portaldasfinancas.gov.pt/faturas/";

export const AT_SOAP_ENVELOPE_NS = "http://schemas.xmlsoap.org/soap/envelope/";

export const AT_WSSE_NS = "http://schemas.xmlsoap.org/ws/2002/12/secext";

export const AT_SOAP_ACTION_REGISTER = `${AT_FATURAS_NS}RegisterInvoice`;

export const AT_FATURAS_ENDPOINTS = {
  production: "https://servicos.portaldasfinancas.gov.pt:400/fews/faturas",
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
  "-98": "Integridade ou multiplicidade dos parâmetros inválidos.",
  "-99": "Erro interno AT.",
};
