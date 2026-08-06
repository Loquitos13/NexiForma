import { parseRetryAfterSec, RATE_LIMIT_DEFAULT_RETRY_SEC } from "./rate-limit-retry";

/** Bloqueio partilhado alinhado com Retry-After do servidor (todas as instâncias de bffFetch). */
let blockedUntilMs = 0;

export function syncRateLimitFromResponse(res: Response): void {
  if (res.status !== 429) return;
  const sec = parseRetryAfterSec(res) ?? RATE_LIMIT_DEFAULT_RETRY_SEC;
  blockedUntilMs = Math.max(blockedUntilMs, Date.now() + sec * 1000);
}

export function clearClientRateLimitBlock(): void {
  blockedUntilMs = 0;
}

export function clientRateLimitRemainingSec(): number {
  return Math.max(0, Math.ceil((blockedUntilMs - Date.now()) / 1000));
}

export function isClientRateLimitBlocked(): boolean {
  return clientRateLimitRemainingSec() > 0;
}

/** Resposta 429 sintética quando o cliente ainda está em cooldown local. */
export function syntheticRateLimitResponse(): Response {
  const sec = clientRateLimitRemainingSec();
  return new Response(
    JSON.stringify({
      message: "Demasiados pedidos. Tente novamente dentro de momentos.",
      statusCode: 429,
      retryAfterSec: sec,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(Math.max(1, sec)),
      },
    },
  );
}
