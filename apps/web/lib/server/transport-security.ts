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

/** Domínios Persona (SDK + embedded flow). Ver https://docs.withpersona.com/embedded-flow-troubleshooting-common-issues */
const PERSONA_SCRIPT_ORIGIN = "https://cdn.withpersona.com";
const PERSONA_FRAME_ORIGINS =
  "https://inquiry.withpersona.com https://*.withpersona.com";

/** Câmara/microfone delegados ao iframe Persona (Permissions-Policy no documento pai). */
const PERMISSIONS_POLICY =
  'camera=(self "https://inquiry.withpersona.com"), microphone=(self "https://inquiry.withpersona.com"), geolocation=()';

export function buildContentSecurityPolicy(): string {
  const isProd = isProductionTransport();

  const connectSrc = isProd
    ? "connect-src 'self' https:"
    : "connect-src 'self' http://localhost:* http://127.0.0.1:* http://192.168.*:* https: ws://localhost:* ws://127.0.0.1:* ws://192.168.*:*";

  const scriptSrc = isProd
    ? `script-src 'self' 'unsafe-inline' ${PERSONA_SCRIPT_ORIGIN}`
    : `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${PERSONA_SCRIPT_ORIGIN}`;

  const directives = [
    "default-src 'self'",
    // Next.js dev (Fast Refresh) e alguns chunks precisam de unsafe-eval; em prod usar nonces no futuro.
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    connectSrc,
    `frame-src blob: https://www.youtube.com https://youtube.com https://player.vimeo.com https://vimeo.com ${PERSONA_FRAME_ORIGINS}`,
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
  { key: "Permissions-Policy", value: PERMISSIONS_POLICY },
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
