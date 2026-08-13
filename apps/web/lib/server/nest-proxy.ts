import {
  APP_PUBLIC_URL_HEADER,
  getNexiBackendBaseUrl,
  resolveIncomingAppPublicUrl,
  resolveUpstreamAuthDetails,
  rewriteSetCookieForBff,
} from "./auth-bff";
import { isAnonymousV1ProxyPath } from "./public-v1-proxy.util";

/** Não faz proxy das rotas de auth (cookies BFF apenas em `/api/auth/*`). OAuth social passa por aqui. */
export function shouldBlockV1AuthProxy(path: string): boolean {
  if (/^auth\/oauth\//i.test(path)) return false;
  if (/^auth\/public\//i.test(path)) return false;
  return /^auth(\/|$)/i.test(path);
}

function rewriteSetCookiePathForBff(setCookie: string): string {
  return setCookie.replace(/;\s*([Pp]ath)=\/v1\//g, "; Path=/api/v1/");
}

function getAllSetCookies(res: Response): string[] {
  const h = res.headers as unknown as { getSetCookie?: () => string[] };
  if (typeof h.getSetCookie === "function") {
    return h.getSetCookie();
  }
  const single = res.headers.get("set-cookie");
  return single ? [single] : [];
}

/** Cabeçalhos do browser que fazem sentido repetir até à Nest. */
function copyIngressHeaders(from: Headers, to: Headers, opts?: { stripAuth?: boolean }): void {
  const cookie = from.get("cookie");
  if (cookie) {
    to.set("cookie", cookie);
  }
  if (!opts?.stripAuth) {
    const auth = from.get("authorization");
    if (auth) {
      to.set("authorization", auth);
    }
  }
  const accept = from.get("accept");
  if (accept) {
    to.set("accept", accept);
  }
  const acceptLang = from.get("accept-language");
  if (acceptLang) {
    to.set("accept-language", acceptLang);
  }
  for (const hop of [
    "x-forwarded-for",
    "x-real-ip",
    "forwarded",
    "x-forwarded-host",
    "x-forwarded-proto",
  ] as const) {
    const v = from.get(hop);
    if (v) {
      to.set(hop, v);
    }
  }
  const origin = from.get("origin");
  if (origin) {
    to.set("origin", origin);
  }
}

const PROXY_TIMEOUT_CAP_MS = 600_000;

/** Rotas de análise IA / PDF podem exceder 60s - alinhar com NEXIGUIA_LLM_* timeouts. */
function resolveUpstreamTimeoutMs(path: string): number {
  const isDev = process.env.NODE_ENV === "development";
  const defaultMs = Number(
    process.env.NEXI_BACKEND_PROXY_TIMEOUT_MS ?? (isDev ? "12000" : "60000"),
  );

  const isInsights = /^relatorios\/insights/i.test(path);
  const isCronogramaImportIa = /^cronogramas\/[^/]+\/importar-ia\/analisar$/i.test(path);
  const isGuideChat = /^guide\/chat/i.test(path);
  if (!isInsights && !isCronogramaImportIa && !isGuideChat) {
    return defaultMs;
  }

  if (isInsights) {
    const explicit = process.env.NEXI_BACKEND_PROXY_INSIGHTS_TIMEOUT_MS;
    if (explicit) {
      return Math.min(Number(explicit), PROXY_TIMEOUT_CAP_MS);
    }
  }

  if (isCronogramaImportIa) {
    const explicit = process.env.NEXI_BACKEND_PROXY_IMPORT_IA_TIMEOUT_MS;
    if (explicit) {
      return Math.min(Number(explicit), PROXY_TIMEOUT_CAP_MS);
    }
  }

  const llmMs = Number(process.env.NEXIGUIA_LLM_TIMEOUT_MS ?? "120000");
  const importMs = Number(process.env.NEXIGUIA_LLM_IMPORT_TIMEOUT_MS ?? "180000");
  // Insights/PDF: ≥120s; import cronograma: orçamento da importação + margem do proxy.
  const apiBudget = isCronogramaImportIa
    ? Math.max(importMs, llmMs, 180_000)
    : Math.max(llmMs, 120_000);
  return Math.min(apiBudget + 45_000, PROXY_TIMEOUT_CAP_MS);
}

/**
 * Replica pedidos `{origin}/api/v1/<recurso>` → `{Nest}/v1/<recurso>` (cookies + Bearer).
 */
export async function proxyV1ToNest(req: Request, pathSegments: string[]): Promise<Response> {
  const path = pathSegments.filter(Boolean).join("/");
  if (!path.length) {
    return new Response(JSON.stringify({ message: "Esperado caminho depois de /api/v1/." }), {
      status: 404,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }

  if (shouldBlockV1AuthProxy(path)) {
    return new Response(
      JSON.stringify({
        message:
          "Autenticação via /api/auth/* (Path da cookie de refresh permanece primeiro em /api/auth).",
      }),
      {
        status: 404,
        headers: { "content-type": "application/json; charset=utf-8" },
      },
    );
  }

  const base = getNexiBackendBaseUrl();
  const urlObj = req.url ? new URL(req.url) : null;
  const search = urlObj?.search ?? "";
  const encodedPath = pathSegments
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  const url = `${base}/v1/${encodedPath}${search}`;

  const method = req.method.toUpperCase();
  const anonymous = isAnonymousV1ProxyPath(path);

  const headers = new Headers();
  copyIngressHeaders(req.headers, headers, { stripAuth: anonymous });

  const extraSetCookies: string[] = [];
  if (!anonymous && !headers.get("authorization")) {
    const resolved = await resolveUpstreamAuthDetails(req);
    if (resolved?.authz) {
      headers.set("authorization", resolved.authz);
      extraSetCookies.push(...resolved.setCookies);
    }
  }

  const appPublicUrl = resolveIncomingAppPublicUrl(req);
  if (appPublicUrl) {
    headers.set(APP_PUBLIC_URL_HEADER, appPublicUrl);
  }

  let body: ArrayBuffer | undefined;
  if (method !== "GET" && method !== "HEAD") {
    const ctype = req.headers.get("content-type");
    if (ctype) {
      headers.set("content-type", ctype);
    }
    const buf = await req.arrayBuffer();
    if (buf.byteLength > 0) {
      body = buf;
    }
  }

  const upstreamTimeoutMs = resolveUpstreamTimeoutMs(path);

  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method,
      headers,
      body: body ?? null,
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(upstreamTimeoutMs),
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : "upstream_error";
    const base = getNexiBackendBaseUrl();
    return new Response(
      JSON.stringify({
        message:
          process.env.NODE_ENV === "production"
            ? `API indisponível em ${base} (${reason}). Verifica o contentor da API e os logs.`
            : `API indisponível em ${base} (${reason}). Confirma que a API está a correr (npm run dev:api).`,
        statusCode: 503,
      }),
      { status: 503, headers: { "content-type": "application/json; charset=utf-8" } },
    );
  }

  const outHeaders = new Headers();
  for (const name of [
    "content-type",
    "content-disposition",
    "content-length",
    "cache-control",
  ] as const) {
    const v = upstream.headers.get(name);
    if (v) {
      outHeaders.set(name, v);
    }
  }

  for (const c of getAllSetCookies(upstream)) {
    outHeaders.append("set-cookie", rewriteSetCookiePathForBff(c));
  }
  for (const c of extraSetCookies) {
    outHeaders.append("set-cookie", rewriteSetCookieForBff(c));
  }

  const buf = await upstream.arrayBuffer();
  return new Response(buf.byteLength ? buf : null, {
    status: upstream.status,
    headers: outHeaders,
  });
}
