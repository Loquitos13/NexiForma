/** IPs e hostnames bloqueados para URLs outbound (webhooks, sync). */
const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "metadata.google.internal",
  "metadata.google",
]);

const PRIVATE_IPV4_RANGES = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\./,
];

const PRIVATE_IPV6_PREFIXES = [/^::1$/i, /^fe80:/i, /^fc/i, /^fd/i];

export type SsrfUrlOptions = {
  /** Em produção exige https:// */
  requireHttps?: boolean;
  /** Permite http:// (dev local) */
  allowHttp?: boolean;
};

export function isBlockedHostname(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[/, "").replace(/\]$/, "");
  if (BLOCKED_HOSTNAMES.has(h)) return true;
  if (h.endsWith(".local") || h.endsWith(".internal")) return true;
  if (PRIVATE_IPV4_RANGES.some((re) => re.test(h))) return true;
  if (PRIVATE_IPV6_PREFIXES.some((re) => re.test(h))) return true;
  return false;
}

/** Validação sintáctica (sem DNS). Usar `assertSafeOutboundUrlResolved` na API antes do fetch. */
export function assertSafeOutboundUrl(raw: string, opts: SsrfUrlOptions = {}): URL {
  const trimmed = raw?.trim();
  if (!trimmed) {
    throw new Error("URL em falta.");
  }
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("URL inválida.");
  }
  if (url.username || url.password) {
    throw new Error("URL não pode conter credenciais embutidas.");
  }
  const proto = url.protocol.toLowerCase();
  if (proto === "https:") {
    // ok
  } else if (proto === "http:" && opts.allowHttp && !opts.requireHttps) {
    // ok em dev
  } else {
    throw new Error("URL deve usar HTTPS.");
  }
  if (!["http:", "https:"].includes(proto)) {
    throw new Error("Protocolo não permitido.");
  }
  if (isBlockedHostname(url.hostname)) {
    throw new Error("Hostname não permitido para webhooks.");
  }
  return url;
}

export function isPrivateIpAddress(ip: string): boolean {
  const normalized = ip.toLowerCase().replace(/^\[/, "").replace(/\]$/, "");
  if (isBlockedHostname(normalized)) return true;
  return false;
}
