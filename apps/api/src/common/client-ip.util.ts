import type { Request } from "express";

/**
 * Extrai e normaliza o IP real do cliente a partir dos headers de proxy e requisição HTTP.
 * Resolve:
 * 1. Cadeia de múltiplos proxies (Nginx -> Next.js BFF -> NestJS API no Docker)
 * 2. Prefixos IPv4-mapped IPv6 (::ffff:192.168.1.1 -> 192.168.1.1)
 * 3. Headers Cloudflare (CF-Connecting-IP), X-Real-IP e X-Forwarded-For
 */
export function extractClientIp(req: Request): string | undefined {
  const cfConnectingIp = req.headers["cf-connecting-ip"];
  const xRealIp = req.headers["x-real-ip"];
  const forwarded = req.headers["x-forwarded-for"];

  let rawIp: string | undefined;

  if (typeof cfConnectingIp === "string" && cfConnectingIp.trim()) {
    rawIp = cfConnectingIp.trim();
  } else if (typeof xRealIp === "string" && xRealIp.trim()) {
    rawIp = xRealIp.trim();
  } else if (typeof forwarded === "string" && forwarded.trim()) {
    // X-Forwarded-For pode ser "client_ip, proxy1_ip, proxy2_ip"
    const parts = forwarded.split(",").map((s) => s.trim()).filter(Boolean);
    rawIp = parts[0];
  } else if (Array.isArray(forwarded) && forwarded.length > 0) {
    rawIp = forwarded[0];
  } else if (typeof req.ip === "string" && req.ip.trim()) {
    rawIp = req.ip.trim();
  }

  if (!rawIp) return undefined;

  // Normalizar prefixo IPv4-mapped IPv6
  if (rawIp.startsWith("::ffff:")) {
    rawIp = rawIp.slice(7);
  }

  // Normalizar loopback IPv6
  if (rawIp === "::1") {
    return "127.0.0.1";
  }

  return rawIp;
}
