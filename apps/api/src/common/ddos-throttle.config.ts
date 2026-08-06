/** Limites anti-DDoS configuráveis via ambiente. */

function envInt(key: string, fallback: number): number {
  const raw = process.env[key]?.trim();
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export function ddosProtectionEnabled(): boolean {
  return process.env.DDOS_ENABLED !== "false";
}

/** Pedidos /min por IP na API (global). */
export function apiGlobalLimitPerMin(): number {
  return envInt("DDOS_API_LIMIT_PER_MIN", 200);
}

/** Pedidos /min por IP em rotas públicas sensíveis (auth, vendas, suporte). */
export function apiStrictLimitPerMin(): number {
  return envInt("DDOS_API_AUTH_LIMIT_PER_MIN", 40);
}

/** Janela TTL padrão (ms). */
export const DDOS_WINDOW_MS = 60_000;

/** Tentativas falhadas de login antes de bloqueio temporário. */
export function loginFailMaxAttempts(): number {
  return envInt("LOGIN_FAIL_MAX_ATTEMPTS", 5);
}

/** Janela para contar falhas de login (ms). */
export function loginFailWindowMs(): number {
  return envInt("LOGIN_FAIL_WINDOW_MS", 900_000);
}

/** Duração do bloqueio após exceder tentativas (ms). */
export function loginFailLockoutMs(): number {
  return envInt("LOGIN_FAIL_LOCKOUT_MS", 900_000);
}

/** Burst curto - picos em janela configurável (web BFF, só `/api/*`). */
export function webBurstPerWindow(): number {
  return envInt("DDOS_WEB_BURST_PER_10S", 80);
}

export function webBurstSessionPerWindow(): number {
  return envInt("DDOS_WEB_BURST_SESSION", 120);
}

export function webBurstWindowMs(): number {
  return envInt("DDOS_WEB_BURST_WINDOW_MS", 15_000);
}

export function webApiLimitPerMin(): number {
  return envInt("DDOS_WEB_API_LIMIT_PER_MIN", 240);
}

export function webApiSessionLimitPerMin(): number {
  return envInt("DDOS_WEB_API_SESSION_LIMIT_PER_MIN", 360);
}

export function webAuthLimitPerMin(): number {
  return envInt("DDOS_WEB_AUTH_LIMIT_PER_MIN", 40);
}

export function webPageLimitPerMin(): number {
  return envInt("DDOS_WEB_PAGE_LIMIT_PER_MIN", 400);
}
