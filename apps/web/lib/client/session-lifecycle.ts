import { getAccessToken, setAccessToken } from "./access-token";

export const SESSION_EXPIRED_EVENT = "nexiforma:session-expired";

let redirecting = false;

/** Verifica expiração do access JWT (com margem de segurança). */
export function isAccessTokenExpired(
  token: string | null | undefined,
  skewSeconds = 30,
): boolean {
  if (!token) return true;
  const parts = token.split(".");
  if (parts.length < 2) return true;
  try {
    const json = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(json) as { exp?: number };
    if (typeof payload.exp !== "number") return false;
    return Date.now() >= (payload.exp - skewSeconds) * 1000;
  } catch {
    return true;
  }
}

export function sessionGoodbyePath(returnTo: string, reason: "expired" | "logout" = "expired"): string {
  return `/adeus?reason=${reason}&next=${encodeURIComponent(returnTo)}`;
}

/** Limpa credenciais e notifica a app; opcionalmente redirecciona para Adeus. */
export function markSessionExpired(options?: { redirect?: boolean; returnTo?: string }) {
  setAccessToken(null);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
    void fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
      cache: "no-store",
    }).catch(() => {});
  }

  if (options?.redirect === false || typeof window === "undefined" || redirecting) {
    return;
  }

  const path = window.location.pathname;
  if (!path.startsWith("/portal") && !path.startsWith("/plataforma")) {
    return;
  }

  redirecting = true;
  const returnTo = options?.returnTo ?? path;
  window.location.replace(sessionGoodbyePath(returnTo, "expired"));
}

export function subscribeSessionExpired(handler: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const wrapped = () => handler();
  window.addEventListener(SESSION_EXPIRED_EVENT, wrapped);
  return () => window.removeEventListener(SESSION_EXPIRED_EVENT, wrapped);
}

export function resetSessionRedirectGuard(): void {
  redirecting = false;
}

/** Rotas autenticadas onde a sessão deve ser validada. */
export function isAuthenticatedAppPath(pathname: string): boolean {
  return pathname.startsWith("/portal") || pathname.startsWith("/plataforma");
}

export function currentAccessToken(): string | null {
  return getAccessToken();
}
