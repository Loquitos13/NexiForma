/** Lê o header Retry-After (segundos) devolvido pela policy anti-DDoS do BFF. */
export function parseRetryAfterSec(res: Response): number | null {
  const raw = res.headers.get("Retry-After")?.trim();
  if (!raw) return null;
  const n = Number(raw);
  if (Number.isFinite(n) && n > 0) return Math.ceil(n);
  return null;
}

/** Fallback quando 429 sem header: janela de burst (10s) ou minuto (60s). */
export const RATE_LIMIT_DEFAULT_RETRY_SEC = 60;

export function retryAfterSecFromResponse(res: Response): number {
  if (res.status !== 429) return 0;
  return parseRetryAfterSec(res) ?? RATE_LIMIT_DEFAULT_RETRY_SEC;
}
