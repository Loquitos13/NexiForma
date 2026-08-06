import { lookup } from "node:dns/promises";
import { assertSafeOutboundUrl, isPrivateIpAddress } from "@nexiforma/shared";

export type SafeFetchOptions = RequestInit & {
  requireHttps?: boolean;
  allowHttp?: boolean;
  maxRedirects?: number;
};

const DEFAULT_MAX_REDIRECTS = 0;

/** Fetch outbound com validação SSRF (hostname + resolução DNS). */
export async function safeFetch(url: string, opts: SafeFetchOptions = {}): Promise<Response> {
  const parsed = assertSafeOutboundUrl(url, {
    requireHttps: opts.requireHttps ?? process.env.NODE_ENV === "production",
    allowHttp: opts.allowHttp ?? process.env.NODE_ENV !== "production",
  });
  await assertResolvedIpsSafe(parsed.hostname);

  const maxRedirects = opts.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  let current = parsed.toString();
  let redirectCount = 0;

  for (;;) {
    const res = await fetch(current, {
      ...opts,
      redirect: "manual",
    });

    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      if (redirectCount >= maxRedirects) {
        throw new Error("Demasiados redirects na URL outbound.");
      }
      const next = new URL(res.headers.get("location")!, current).toString();
      const nextParsed = assertSafeOutboundUrl(next, {
        requireHttps: opts.requireHttps ?? process.env.NODE_ENV === "production",
        allowHttp: opts.allowHttp ?? process.env.NODE_ENV !== "production",
      });
      await assertResolvedIpsSafe(nextParsed.hostname);
      current = next;
      redirectCount += 1;
      continue;
    }

    return res;
  }
}

async function assertResolvedIpsSafe(hostname: string): Promise<void> {
  if (isPrivateIpAddress(hostname)) {
    throw new Error("IP privado não permitido.");
  }
  try {
    const records = await lookup(hostname, { all: true, verbatim: true });
    for (const r of records) {
      if (isPrivateIpAddress(r.address)) {
        throw new Error("DNS resolve para IP privado ou bloqueado.");
      }
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes("privado")) throw e;
    throw new Error("Não foi possível resolver o hostname de forma segura.");
  }
}
