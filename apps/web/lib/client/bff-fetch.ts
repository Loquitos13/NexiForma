import { getAccessToken, setAccessToken } from "./access-token";

export type BffFetchInit = RequestInit & {
  /**
   * Se true (defeito): envia `Authorization: Bearer` quando há token guardado,
   * e em resposta **401** tenta uma vez `POST /api/auth/refresh` (cookie HttpOnly),
   * grava novo access e volta a repetir o pedido.
   */
  authRetry401?: boolean;
};

let refreshSingleton: Promise<string | null> | null = null;

/**
 * Obtém novo access JWT via BFF usando só a cookie de refresh (credentials).
 * Chamadas paralelas durante o refresh partilham o mesmo pedido (`Promise`).
 */
export function refreshViaBffCookies(): Promise<string | null> {
  if (!refreshSingleton) {
    refreshSingleton = (async (): Promise<string | null> => {
      try {
        const res = await fetch("/api/auth/refresh", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
        });
        if (!res.ok) return null;
        const data = (await res.json().catch(() => null)) as {
          accessToken?: string;
        } | null;
        const tok = typeof data?.accessToken === "string" ? data.accessToken : null;
        if (tok) setAccessToken(tok);
        return tok;
      } catch {
        return null;
      } finally {
        refreshSingleton = null;
      }
    })();
  }
  return refreshSingleton;
}

function mergeBearer(headers: Headers, token: string | null): void {
  if (token) headers.set("authorization", `Bearer ${token}`);
}

function buildAuthHeaders(
  init: RequestInit,
  token: string | null,
  authRetry401: boolean,
): HeadersInit | undefined {
  const isFormData =
    typeof FormData !== "undefined" && init.body instanceof FormData;

  if (isFormData) {
    if (!authRetry401 || !token) return undefined;
    return { authorization: `Bearer ${token}` };
  }

  const headers = new Headers(init.headers);
  if (authRetry401) mergeBearer(headers, token);
  return headers;
}

/**
 * `fetch` same-origin ao BFF com `credentials: "include"` e pipeline de refresh em 401.
 * Usar só no cliente (`"use client"`).
 *
 * Fluxos típicos: **sem** bearer na memória mas com cookie válida (`sessionStorage`
 * limpa) → primeiro pedido pode ser 401 → refresh guarda novo token → retry com 200.
 */
export async function bffFetch(
  input: RequestInfo | URL,
  init: BffFetchInit = {},
): Promise<Response> {
  const authRetry401 = init.authRetry401 !== false;
  const { authRetry401: _omit, ...restInit } = init;
  let attempt = 0;

  while (true) {
    let token = getAccessToken();
    if (authRetry401 && !token && attempt === 0) {
      token = await refreshViaBffCookies();
    }

    const headers = buildAuthHeaders(restInit, token, authRetry401);

    const res = await fetch(input, {
      ...restInit,
      ...(headers ? { headers } : {}),
      credentials: "include",
      cache: restInit.cache ?? "no-store",
    });

    if (!authRetry401 || res.status !== 401 || attempt >= 1) {
      return res;
    }

    const tok = await refreshViaBffCookies();
    if (!tok) {
      setAccessToken(null);
      return res;
    }

    attempt += 1;
  }
}
