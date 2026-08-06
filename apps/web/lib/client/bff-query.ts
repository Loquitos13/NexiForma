import { bffFetch } from "./bff-fetch";

export type BffQueryInit = {
  body?: unknown;
  headers?: HeadersInit;
  authRetry401?: boolean;
};

/**
 * Pedido de leitura segura ao BFF - corpo JSON, sem dados na URL.
 * Usa POST porque o App Router do Next.js não suporta o método QUERY (RFC 10008).
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
    method: "POST",
    headers,
    body: JSON.stringify(init.body ?? {}),
    authRetry401: init.authRetry401,
  });
}
