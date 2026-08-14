/**
 * Rotas /api/v1/* anónimas - não injectar Bearer derivado de cookies
 * (evita 401 em accept-invite quando há sessão expirada no browser).
 */
const ANONYMOUS_V1_PREFIXES = [
  "users/accept-invite",
  "users/invite-info/",
  "propostas/responder",
  "verificacao/",
  "public/",
  "health",
  "guide/",
  "support/tickets",
] as const;

export function isAnonymousV1ProxyPath(path: string): boolean {
  const normalized = path.replace(/^\/+|\/+$/g, "");
  return ANONYMOUS_V1_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(prefix),
  );
}
