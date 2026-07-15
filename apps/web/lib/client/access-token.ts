/** JWT curto-vida - apenas sessionStorage (não persiste em localStorage). */
export const ACCESS_TOKEN_STORAGE_KEY = "nexiforma_access";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
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
    } catch {
      /* limpar legado */
    }
  } catch {
    /* storage indisponível */
  }
}

/** Popups: copiar token da janela que abriu (sessionStorage não partilha entre janelas). */
export function syncAccessTokenToLocalStorage(): void {
  if (typeof window === "undefined") return;
  try {
    const tok = sessionStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
    if (!tok && window.opener) {
      /* opener partilha via postMessage noutros fluxos; refresh via cookie cobre novo separador */
    }
  } catch {
    /* ignore */
  }
}
