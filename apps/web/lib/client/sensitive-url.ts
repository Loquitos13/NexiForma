/**
 * Lê parâmetros sensíveis da URL uma vez, guarda em sessionStorage e limpa a barra de endereço.
 */
export function consumeSensitiveUrlParams(keys: string[]): Record<string, string> {
  if (typeof window === "undefined") return {};
  const out: Record<string, string> = {};
  const url = new URL(window.location.href);
  let changed = false;

  for (const key of keys) {
    const storageKey = `nexiforma_url_${key}`;
    const fromUrl = url.searchParams.get(key)?.trim();
    if (fromUrl) {
      try {
        sessionStorage.setItem(storageKey, fromUrl);
      } catch {
        /* ignore */
      }
      url.searchParams.delete(key);
      changed = true;
      out[key] = fromUrl;
    } else {
      try {
        const stored = sessionStorage.getItem(storageKey)?.trim();
        if (stored) out[key] = stored;
      } catch {
        /* ignore */
      }
    }
  }

  if (changed) {
    const next = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState(window.history.state, "", next);
  }

  return out;
}

export function clearSensitiveUrlParam(key: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(`nexiforma_url_${key}`);
  } catch {
    /* ignore */
  }
}
