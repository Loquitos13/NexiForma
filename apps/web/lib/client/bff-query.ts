import { HTTP_QUERY_METHOD } from "@nexiforma/shared";
import { bffFetch } from "./bff-fetch";

export type BffQueryInit = {
  body?: unknown;
  headers?: HeadersInit;
  authRetry401?: boolean;
};

/**
 * Pedido QUERY (RFC 10008) ao BFF - leitura segura com corpo JSON (sem dados na URL).
 */
export async function bffQuery(
  path: string,
  init: BffQueryInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  if (!headers.has("accept")) {
    headers.set("accept", "application/json");
  }

  return bffFetch(path, {
    method: HTTP_QUERY_METHOD,
    headers,
    body: JSON.stringify(init.body ?? {}),
    authRetry401: init.authRetry401,
  });
}
