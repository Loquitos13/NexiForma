/**
 * Rate limit no edge Next.js (BFF + páginas) - primeira linha anti-DDoS.
 * Em produção multi-instância, complementar com WAF/ALB (AWS Shield).
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

function hit(
  store: Map<string, WindowEntry>,
  key: string,
  limit: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  const entry = store.get(key);
  if (!entry || now >= entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count += 1;
  return true;
}

function prune(store: Map<string, WindowEntry>, now: number): void {
  if (store.size < 5000) return;
  for (const [k, v] of store) {
    if (now >= v.resetAt) store.delete(k);
  }
}

export type DdosCheckResult = { allowed: true } | { allowed: false; retryAfterSec: number };

export function checkWebDdosRateLimit(request: {
  nextUrl: { pathname: string };
  headers: Headers;
  ip?: string | null;
}): DdosCheckResult {
  if (!ddosEnabled()) return { allowed: true };

  const pathname = request.nextUrl.pathname;
  const ip = clientIp(request);
  const now = Date.now();
  prune(minuteStore, now);
  prune(burstStore, now);

  const burstLimit = envInt("DDOS_WEB_BURST_PER_10S", 40);
  const burstKey = `${ip}:burst`;
  if (!hit(burstStore, burstKey, burstLimit, 10_000)) {
    return { allowed: false, retryAfterSec: 10 };
  }

  let limit: number;
  let bucket: string;
  if (pathname.startsWith("/api/auth")) {
    limit = envInt("DDOS_WEB_AUTH_LIMIT_PER_MIN", 25);
    bucket = "auth";
  } else if (pathname.startsWith("/api/")) {
    limit = envInt("DDOS_WEB_API_LIMIT_PER_MIN", 120);
    bucket = "api";
  } else {
    limit = envInt("DDOS_WEB_PAGE_LIMIT_PER_MIN", 300);
    bucket = "page";
  }

  const minuteKey = `${ip}:${bucket}`;
  if (!hit(minuteStore, minuteKey, limit, 60_000)) {
    return { allowed: false, retryAfterSec: 60 };
  }

  return { allowed: true };
}
