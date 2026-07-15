/** RFC 10008 - leitura segura com corpo (sem dados sensíveis na URL). */
export const HTTP_QUERY_METHOD = "QUERY" as const;

export type HttpQueryMethod = typeof HTTP_QUERY_METHOD;
