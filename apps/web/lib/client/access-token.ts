/** JWT curto-vida - sessionStorage + localStorage (popups partilham localStorage). */
export const ACCESS_TOKEN_STORAGE_KEY = "nexiforma_access";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return (
      sessionStorage.getItem(ACCESS_TOKEN_STORAGE_KEY) ??
      localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)
    );
  } catch {
    return null;
  }
}

export function setAccessToken(accessToken: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (accessToken) {
      sessionStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, accessToken);
      localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, accessToken);
    } else {
      sessionStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
      localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
    }
  } catch {
    /* storage indisponível */
  }
}

/** Garante token na popup (herda do separador que abriu). */
export function syncAccessTokenToLocalStorage(): void {
  if (typeof window === "undefined") return;
  try {
    const tok = sessionStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
    if (tok) localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, tok);
  } catch {
    /* ignore */
  }
}
