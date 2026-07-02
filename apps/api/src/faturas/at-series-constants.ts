/** Webservice comunicação de séries documentais – Portaria 195/2020. */
export const AT_SERIES_NS = "http://at.gov.pt/";

export const AT_SERIES_SOAP_ACTION = AT_SERIES_NS;

export const AT_SERIES_ENDPOINTS = {
  production: "https://servicos.portaldasfinancas.gov.pt:422/SeriesWSService",
  sandbox: "https://servicos.portaldasfinancas.gov.pt:722/SeriesWSService",
} as const;

/** meioProcessamento: PI = programa informático certificado */
export const AT_SERIES_MEIO_PI = "PI";

/** classeDoc: SI = sistema informático */
export const AT_SERIES_CLASSE_SI = "SI";

/** tipoSerie: N = normal */
export const AT_SERIES_TIPO_NORMAL = "N";

export const AT_SERIES_RETURN_MESSAGES: Record<string, string> = {
  "0": "Série registada com sucesso.",
  "-1": "Parâmetros inválidos.",
  "-2": "Série já registada.",
  "-3": "Utilizador sem permissões WSE.",
  "-4": "Certificado software inválido.",
  "-99": "Erro interno AT.",
};
