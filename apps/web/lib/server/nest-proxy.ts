import { getNexiBackendBaseUrl, resolveUpstreamAuthorization } from "./auth-bff";

/** Não faz proxy das rotas de auth (cookies BFF apenas em `/api/auth/*`). */
const SKIP_AUTH_ROUTE = /^auth(\/|$)/i;

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
function copyIngressHeaders(from: Headers, to: Headers): void {
  const cookie = from.get("cookie");
  if (cookie) {
    to.set("cookie", cookie);
  }
  const auth = from.get("authorization");
  if (auth) {
    to.set("authorization", auth);
  }
  const accept = from.get("accept");
  if (accept) {
    to.set("accept", accept);
  }
  const acceptLang = from.get("accept-language");
  if (acceptLang) {
    to.set("accept-language", acceptLang);
  }
  for (const hop of ["x-forwarded-for", "x-real-ip", "forwarded"] as const) {
    const v = from.get(hop);
    if (v) {
      to.set(hop, v);
    }
  }
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

  if (SKIP_AUTH_ROUTE.test(path)) {
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
  const url = `${base}/v1/${path}${search}`;

  const method = req.method.toUpperCase();

  const headers = new Headers();
  copyIngressHeaders(req.headers, headers);

  if (!headers.get("authorization")) {
    const authz = await resolveUpstreamAuthorization(req);
    if (authz) headers.set("authorization", authz);
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

  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method,
      headers,
      body: body ?? null,
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(60_000),
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : "upstream_error";
    return new Response(
      JSON.stringify({
        message: `API indisponível (${reason}).`,
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

  const buf = await upstream.arrayBuffer();
  return new Response(buf.byteLength ? buf : null, {
    status: upstream.status,
    headers: outHeaders,
  });
}
