import { getAccessToken, setAccessToken } from "./access-token";
import {
  isAccessTokenExpired,
  markSessionExpired,
  isAuthenticatedAppPath,
} from "./session-lifecycle";
import { tokenKindMismatchForPath } from "./jwt-role";
import {
  clientRateLimitRemainingSec,
  isClientRateLimitBlocked,
  syncRateLimitFromResponse,
  syntheticRateLimitResponse,
} from "./rate-limit-client";

export type BffFetchInit = RequestInit & {
  /**
   * Se true (defeito): envia `Authorization: Bearer` quando há token guardado,
   * e em resposta **401** tenta uma vez `POST /api/auth/refresh` (cookie HttpOnly),
   * grava novo access e volta a repetir o pedido.
   */
  authRetry401?: boolean;
};

let refreshSingleton: Promise<string | null> | null = null;
let lastRefreshFailureAt = 0;
const REFRESH_FAILURE_COOLDOWN_MS = 8_000;

/**
 * Obtém novo access JWT via BFF usando só a cookie de refresh (credentials).
 * Chamadas paralelas durante o refresh partilham o mesmo pedido (`Promise`).
 */
export function refreshViaBffCookies(): Promise<string | null> {
  const now = Date.now();
  if (lastRefreshFailureAt > 0 && now - lastRefreshFailureAt < REFRESH_FAILURE_COOLDOWN_MS) {
    return Promise.resolve(null);
  }

  if (!refreshSingleton) {
    refreshSingleton = (async (): Promise<string | null> => {
      try {
        const res = await fetch("/api/auth/refresh", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
        });
        if (!res.ok) {
          lastRefreshFailureAt = Date.now();
          return null;
        }
        const data = (await res.json().catch(() => null)) as {
          accessToken?: string;
        } | null;
        const tok = typeof data?.accessToken === "string" ? data.accessToken : null;
        if (tok) {
          lastRefreshFailureAt = 0;
          setAccessToken(tok);
        } else {
          lastRefreshFailureAt = Date.now();
        }
        return tok;
      } catch {
        lastRefreshFailureAt = Date.now();
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
  if (isClientRateLimitBlocked()) {
    return syntheticRateLimitResponse();
  }

  const authRetry401 = init.authRetry401 !== false;
  const { authRetry401: _omit, ...restInit } = init;
  let attempt = 0;

  while (true) {
    let token = getAccessToken();
    if (authRetry401 && attempt === 0) {
      const path = typeof window !== "undefined" ? window.location.pathname : "";
      if (token && path && tokenKindMismatchForPath(path, token)) {
        setAccessToken(null);
        token = null;
      }
      if (!token || isAccessTokenExpired(token)) {
        token = await refreshViaBffCookies();
      }
    }

    const headers = buildAuthHeaders(restInit, token, authRetry401);

    const res = await fetch(input, {
      ...restInit,
      ...(headers ? { headers } : {}),
      credentials: "include",
      cache: restInit.cache ?? "no-store",
    });

    if (!authRetry401 || res.status !== 401 || attempt >= 1) {
      if (res.status === 429) syncRateLimitFromResponse(res);
      return res;
    }

    const tok = await refreshViaBffCookies();
    if (!tok) {
      if (typeof window !== "undefined") {
        if (isAuthenticatedAppPath(window.location.pathname)) {
          setAccessToken(null);
          markSessionExpired({ returnTo: window.location.pathname });
        }
      }
      return res;
    }

    attempt += 1;
  }
}
