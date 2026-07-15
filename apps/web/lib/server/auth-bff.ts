import { API_PREFIX } from "@nexiforma/shared";
import { NextResponse } from "next/server";

/** URL base da API Nest (só servidor; não deve ser obrigatório no cliente). */
export function getNexiBackendBaseUrl(): string {
  const explicit =
    process.env.API_URL?.trim() || process.env.NEXT_PUBLIC_API_URL?.trim();
  const port = process.env.API_PORT?.trim();

  if (explicit) {
    if (port && process.env.NODE_ENV === "development") {
      try {
        const u = new URL(explicit.startsWith("http") ? explicit : `http://${explicit}`);
        const host = u.hostname === "localhost" ? "127.0.0.1" : u.hostname;
        if ((host === "127.0.0.1" || host === "localhost") && u.port && u.port !== port) {
          return normalizeBackendUrl(`http://127.0.0.1:${port}`);
        }
      } catch {
        /* mantém explicit */
      }
    }
    return normalizeBackendUrl(explicit);
  }

  const resolvedPort = port || "4000";
  return normalizeBackendUrl(`http://127.0.0.1:${resolvedPort}`);
}

/** Evita ECONNREFUSED no Windows quando `localhost` resolve para ::1 e a API escuta só em IPv4. */
function normalizeBackendUrl(raw: string): string {
  const trimmed = raw.replace(/\/$/, "");
  try {
    const u = new URL(trimmed);
    if (u.hostname === "localhost") {
      u.hostname = "127.0.0.1";
    }
    return u.toString().replace(/\/$/, "");
  } catch {
    return trimmed;
  }
}

/** Path das cookies definidas pela API (deve coincidir com `AUTH_COOKIE_PATH` no Nest, por defeito `/${API_PREFIX}/auth`). */
export function nestAuthCookiePathSegment(): string {
  const ov = process.env.NEST_AUTH_COOKIE_PATH?.trim();
  if (ov) {
    return ov.startsWith("/") ? ov : `/${ov}`;
  }
  return `/${API_PREFIX}/auth`;
}

/** Path onde o browser envia a refresh cookie (first-party no Next). `/` para o middleware `/portal` a detectar sessão. */
export function bffAuthCookiePath(): string {
  const ov = process.env.BFF_AUTH_COOKIE_PATH?.trim();
  if (ov) {
    return ov.startsWith("/") ? ov : `/${ov}`;
  }
  return "/";
}

/**
 * Reescreve `Path` da Set-Cookie do Nest para o path do BFF (ex.: `/v1/auth` → `/api/auth`).
 */
export function rewriteSetCookieForBff(setCookie: string): string {
  const from = nestAuthCookiePathSegment();
  const to = bffAuthCookiePath();
  if (from === to) {
    return setCookie;
  }
  const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return setCookie.replace(new RegExp(`;\\s*([Pp]ath)=${escaped}\\b`, "g"), `; Path=${to}`);
}

function getAllSetCookies(res: Response): string[] {
  const h = res.headers as unknown as { getSetCookie?: () => string[] };
  if (typeof h.getSetCookie === "function") {
    return h.getSetCookie();
  }
  const single = res.headers.get("set-cookie");
  return single ? [single] : [];
}

function forwardJsonHeaders(from: Headers): Headers {
  const n = new Headers();
  const ct = from.get("content-type");
  if (ct) {
    n.set("content-type", ct);
  }
  return n;
}

const REFRESH_COOKIE = "nexiforma_refresh";

/**
 * Se o browser não enviou Bearer (token só em sessionStorage), obtém access JWT
 * via refresh cookie HttpOnly - uploads multipart dependem disto.
 */
export async function resolveUpstreamAuthorization(incoming: Request): Promise<string | undefined> {
  const existing = incoming.headers.get("authorization")?.trim();
  if (existing) return existing;

  const cookie = incoming.headers.get("cookie");
  if (!cookie?.includes(REFRESH_COOKIE)) return undefined;

  const base = getNexiBackendBaseUrl();
  try {
    const res = await fetch(`${base}/${API_PREFIX}/auth/refresh`, {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return undefined;
    const data = (await res.json()) as { accessToken?: string };
    if (typeof data.accessToken === "string" && data.accessToken.length > 0) {
      return `Bearer ${data.accessToken}`;
    }
  } catch {
    /* refresh indisponível */
  }
  return undefined;
}

export type ProxyAuthOptions = {
  nestPath: `/${string}`;
  method: "GET" | "POST";
  /** Corpo JSON para POST */
  body?: unknown;
  /** Pedido do browser (cookies + Authorization) */
  incoming: Request;
};

/** Cabeçalho enviado à API para links em email usarem o mesmo host do pedido. */
export const APP_PUBLIC_URL_HEADER = "x-nexiforma-app-public-url";

/** Origem pública do pedido ao Next (ex.: http://192.168.1.86:3000). */
export function resolveIncomingAppPublicUrl(req: Request): string | undefined {
  try {
    const url = new URL(req.url);
    if (url.origin && url.origin !== "null") {
      return url.origin;
    }
  } catch {
    /* ignore */
  }
  const fwdHost = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = fwdHost ?? req.headers.get("host")?.trim();
  if (!host) return undefined;
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ?? "http";
  return `${proto}://${host}`;
}

/**
 * Encaminha para `GET` ou `POST` na API Nest e devolve `NextResponse` com cookies reescritas.
 */
export async function proxyAuthToNest(opts: ProxyAuthOptions): Promise<NextResponse> {
  const base = getNexiBackendBaseUrl();
  const url = `${base}${opts.nestPath}`;

  const headers = new Headers();
  const cookie = opts.incoming.headers.get("cookie");
  if (cookie) {
    headers.set("cookie", cookie);
  }
  const authz = opts.incoming.headers.get("authorization");
  if (authz) {
    headers.set("authorization", authz);
  }
  for (const hop of ["x-forwarded-for", "x-real-ip", "forwarded", "x-forwarded-host", "x-forwarded-proto"] as const) {
    const v = opts.incoming.headers.get(hop);
    if (v) {
      headers.set(hop, v);
    }
  }
  const appPublicUrl = resolveIncomingAppPublicUrl(opts.incoming);
  if (appPublicUrl) {
    headers.set(APP_PUBLIC_URL_HEADER, appPublicUrl);
  }
  if (opts.incoming.headers.get("origin")) {
    headers.set("origin", opts.incoming.headers.get("origin")!);
  }
  if (opts.method === "POST" && opts.body !== undefined) {
    headers.set("content-type", "application/json");
  }

  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: opts.method,
      headers,
      body:
        opts.method === "POST" && opts.body !== undefined
          ? JSON.stringify(opts.body)
          : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : "upstream_error";
    return NextResponse.json(
      {
        message:
          "API indisponível. Confirma que `npm run dev:api` está a correr em " +
          `${base} (${reason}).`,
        statusCode: 503,
      },
      { status: 503 },
    );
  }

  const responseHeaders = forwardJsonHeaders(upstream.headers);
  const setCookies = getAllSetCookies(upstream);
  for (const c of setCookies) {
    responseHeaders.append("set-cookie", rewriteSetCookieForBff(c));
  }

  if (upstream.status === 204) {
    return new NextResponse(null, {
      status: 204,
      headers: responseHeaders,
    });
  }

  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: responseHeaders,
  });
}
