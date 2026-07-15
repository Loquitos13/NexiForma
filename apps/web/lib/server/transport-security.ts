/**
 * Políticas de transporte anti-MITM (portal web).
 * Em produção: HTTPS obrigatório, HSTS, sem mixed content na CSP.
 */

export const HSTS_VALUE =
  "max-age=63072000; includeSubDomains; preload";

export function isProductionTransport(): boolean {
  return process.env.NODE_ENV === "production";
}

/** Desactivar só em dev local explícito: FORCE_HTTPS=false */
export function shouldEnforceHttps(): boolean {
  if (!isProductionTransport()) return false;
  return process.env.FORCE_HTTPS !== "false";
}

export function buildContentSecurityPolicy(): string {
  const isProd = isProductionTransport();

  const connectSrc = isProd
    ? "connect-src 'self' https:"
    : "connect-src 'self' http://localhost:* http://127.0.0.1:* http://192.168.*:* https: ws://localhost:* ws://127.0.0.1:* ws://192.168.*:*";

  const directives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    connectSrc,
    "frame-src https://www.youtube.com https://youtube.com https://player.vimeo.com https://vimeo.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];

  if (isProd) {
    directives.push("upgrade-insecure-requests");
  }

  return directives.join("; ");
}

export const TRANSPORT_SECURITY_HEADERS: ReadonlyArray<{ key: string; value: string }> = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-site" },
];

export function productionOnlyHeaders(): ReadonlyArray<{ key: string; value: string }> {
  if (!isProductionTransport()) return [];
  return [{ key: "Strict-Transport-Security", value: HSTS_VALUE }];
}

export function applyTransportHeadersToHeaders(headers: Headers): void {
  for (const { key, value } of TRANSPORT_SECURITY_HEADERS) {
    headers.set(key, value);
  }
  headers.set("Content-Security-Policy", buildContentSecurityPolicy());
  for (const { key, value } of productionOnlyHeaders()) {
    headers.set(key, value);
  }
}
