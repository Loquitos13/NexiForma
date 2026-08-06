/**
 * Rate limit no edge Next.js (BFF + páginas) - primeira linha anti-DDoS.
 * Burst aplica-se só a `/api/*`; navegação entre views usa bucket por minuto.
 * Em produção multi-instância, complementar com WAF/ALB (AWS Shield) + REDIS_URL na API.
 */

type WindowEntry = { count: number; resetAt: number };

const minuteStore = new Map<string, WindowEntry>();
const burstStore = new Map<string, WindowEntry>();

function envInt(key: string, fallback: number): number {
  const raw = process.env[key]?.trim();
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function ddosEnabled(): boolean {
  return process.env.DDOS_ENABLED !== "false";
}

function clientIp(request: { headers: Headers; ip?: string | null }): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const ip = forwarded.split(",")[0]?.trim();
    if (ip) return ip;
  }
  const real = request.headers.get("x-real-ip");
  if (real?.trim()) return real.trim();
  return request.ip ?? "unknown";
}

type HitResult = { allowed: true } | { allowed: false; retryAfterSec: number };

function hit(
  store: Map<string, WindowEntry>,
  key: string,
  limit: number,
  windowMs: number,
): HitResult {
  const now = Date.now();
  const entry = store.get(key);
  if (!entry || now >= entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }
  if (entry.count >= limit) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
    };
  }
  entry.count += 1;
  return { allowed: true };
}

function prune(store: Map<string, WindowEntry>, now: number): void {
  if (store.size < 5000) return;
  for (const [k, v] of store) {
    if (now >= v.resetAt) store.delete(k);
  }
}

function shouldSkipPath(pathname: string): boolean {
  return (
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname.startsWith("/icon") ||
    pathname.endsWith(".svg") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".webp")
  );
}

export type DdosCheckResult = { allowed: true } | { allowed: false; retryAfterSec: number };

export type WebDdosRequest = {
  nextUrl: { pathname: string };
  headers: Headers;
  ip?: string | null;
  cookies?: { has: (name: string) => boolean };
};

export function checkWebDdosRateLimit(request: WebDdosRequest): DdosCheckResult {
  if (!ddosEnabled()) return { allowed: true };

  const pathname = request.nextUrl.pathname;
  if (shouldSkipPath(pathname)) return { allowed: true };

  const ip = clientIp(request);
  const now = Date.now();
  prune(minuteStore, now);
  prune(burstStore, now);

  const hasSession = request.cookies?.has("nexiforma_refresh") ?? false;
  const burstWindowMs = envInt("DDOS_WEB_BURST_WINDOW_MS", 15_000);

  /** Burst curto - só pedidos API (navegação RSC/HTML não consome burst). */
  if (pathname.startsWith("/api/")) {
    const burstLimit = hasSession
      ? envInt("DDOS_WEB_BURST_SESSION", 120)
      : envInt("DDOS_WEB_BURST_PER_10S", 80);
    const burstKey = `${ip}:burst:${hasSession ? "sess" : "anon"}`;
    const burst = hit(burstStore, burstKey, burstLimit, burstWindowMs);
    if (!burst.allowed) return burst;
  }

  let limit: number;
  let bucket: string;
  if (pathname.startsWith("/api/auth")) {
    limit = envInt("DDOS_WEB_AUTH_LIMIT_PER_MIN", 40);
    bucket = "auth";
  } else if (pathname.startsWith("/api/")) {
    limit = hasSession
      ? envInt("DDOS_WEB_API_SESSION_LIMIT_PER_MIN", 360)
      : envInt("DDOS_WEB_API_LIMIT_PER_MIN", 240);
    bucket = hasSession ? "api-sess" : "api";
  } else {
    limit = envInt("DDOS_WEB_PAGE_LIMIT_PER_MIN", 400);
    bucket = "page";
  }

  const minuteKey = `${ip}:${bucket}`;
  const minute = hit(minuteStore, minuteKey, limit, 60_000);
  if (!minute.allowed) return minute;

  return { allowed: true };
}
