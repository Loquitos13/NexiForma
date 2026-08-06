/** Extrai o token de presença de um URL ou string lida pelo QR. */
export function extractPresencaToken(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  try {
    const u = new URL(t);
    const m = u.pathname.match(/\/presenca\/([^/?#]+)/i);
    if (m?.[1]) return decodeURIComponent(m[1]);
  } catch {
    /* não é URL absoluto */
  }
  const relative = t.match(/\/presenca\/([^/?#]+)/i);
  if (relative?.[1]) return decodeURIComponent(relative[1]);
  if (/^[A-Za-z0-9_-]{12,}$/.test(t)) return t;
  return null;
}
