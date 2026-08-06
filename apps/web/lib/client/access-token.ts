/** JWT curto-vida - apenas sessionStorage (não persiste em localStorage). */
export const ACCESS_TOKEN_STORAGE_KEY = "nexiforma_access";
export const ACCESS_TOKEN_CHANGED_EVENT = "nexiforma:access-token-changed";

/**
 * Handoff one-shot para novo separador/popup: sessionStorage não é partilhado
 * quando se usa window.open com noopener.
 */
const ACCESS_TOKEN_HANDOFF_KEY = "nexiforma_access_handoff";

function consumeAccessTokenHandoff(): string | null {
  try {
    const handoff = localStorage.getItem(ACCESS_TOKEN_HANDOFF_KEY);
    if (!handoff) return null;
    localStorage.removeItem(ACCESS_TOKEN_HANDOFF_KEY);
    sessionStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, handoff);
    return handoff;
  } catch {
    return null;
  }
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const existing = sessionStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
    if (existing) return existing;
    return consumeAccessTokenHandoff();
  } catch {
    return null;
  }
}

export function setAccessToken(accessToken: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (accessToken) {
      sessionStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, accessToken);
    } else {
      sessionStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
    }
    try {
      localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
      localStorage.removeItem(ACCESS_TOKEN_HANDOFF_KEY);
    } catch {
      /* limpar legado / handoff */
    }
    window.dispatchEvent(new CustomEvent(ACCESS_TOKEN_CHANGED_EVENT));
  } catch {
    /* storage indisponível */
  }
}

/**
 * Prepara o access JWT para a próxima navegação same-origin noutro separador.
 * O destino consome o valor na primeira `getAccessToken()`.
 */
export function prepareAccessTokenHandoff(): void {
  if (typeof window === "undefined") return;
  try {
    const tok = sessionStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
    if (!tok) return;
    localStorage.setItem(ACCESS_TOKEN_HANDOFF_KEY, tok);
    window.setTimeout(() => {
      try {
        localStorage.removeItem(ACCESS_TOKEN_HANDOFF_KEY);
      } catch {
        /* ignore */
      }
    }, 15_000);
  } catch {
    /* ignore */
  }
}

/** Abre URL same-origin noutro separador, com handoff do access token. */
export function openAuthenticatedPortalTab(path: string, target = "_blank"): Window | null {
  prepareAccessTokenHandoff();
  return window.open(path, target, "noopener,noreferrer");
}

/** Popups legados: garante token local antes de pedidos BFF. */
export function syncAccessTokenToLocalStorage(): void {
  if (typeof window === "undefined") return;
  try {
    if (!sessionStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)) {
      consumeAccessTokenHandoff();
    }
  } catch {
    /* ignore */
  }
}
