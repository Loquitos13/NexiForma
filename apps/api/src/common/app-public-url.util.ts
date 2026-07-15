import type { ConfigService } from "@nestjs/config";

export const APP_PUBLIC_URL_HEADER = "x-nexiforma-app-public-url";

function normalizeOrigin(raw: string): string {
  const trimmed = raw.trim().replace(/\/$/, "");
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const u = new URL(withScheme);
  if (u.pathname !== "/" && u.pathname !== "") {
    throw new Error("invalid origin path");
  }
  return u.origin;
}

function isPrivateOrLocalHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h === "127.0.0.1" || h === "[::1]") return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  return false;
}

function collectConfiguredOrigins(config: ConfigService): Set<string> {
  const out = new Set<string>();
  const app = config.get<string>("APP_PUBLIC_URL")?.trim();
  if (app) {
    try {
      out.add(normalizeOrigin(app));
    } catch {
      /* ignore malformed APP_PUBLIC_URL */
    }
  }
  for (const part of (config.get<string>("CORS_ORIGIN") ?? "").split(",")) {
    const t = part.trim();
    if (!t) continue;
    try {
      out.add(normalizeOrigin(t));
    } catch {
      /* ignore */
    }
  }
  return out;
}

function originsEquivalent(a: string, b: string): boolean {
  try {
    return normalizeOrigin(a) === normalizeOrigin(b);
  } catch {
    return false;
  }
}

export function isAllowedAppPublicUrl(origin: string, config: ConfigService): boolean {
  try {
    const normalized = normalizeOrigin(origin);
    const allowed = collectConfiguredOrigins(config);
    for (const item of allowed) {
      if (originsEquivalent(item, normalized)) return true;
    }
    if (config.get<string>("NODE_ENV") !== "production") {
      const host = new URL(normalized).hostname;
      if (isPrivateOrLocalHost(host)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

/** Base URL da app Web para links em email — preferência ao pedido HTTP, fallback APP_PUBLIC_URL. */
export function resolveAppPublicUrl(
  config: ConfigService,
  req?: { headers: Record<string, string | string[] | undefined> },
): string {
  const fallbackRaw = config.get<string>("APP_PUBLIC_URL") ?? "http://localhost:3000";
  let fallback = "http://localhost:3000";
  try {
    fallback = normalizeOrigin(fallbackRaw);
  } catch {
    /* keep default */
  }

  const header = req?.headers?.[APP_PUBLIC_URL_HEADER];
  const fromHeader = typeof header === "string" ? header.trim() : "";
  if (fromHeader && isAllowedAppPublicUrl(fromHeader, config)) {
    return normalizeOrigin(fromHeader);
  }

  const origin = req?.headers?.origin;
  const fromOrigin = typeof origin === "string" ? origin.trim() : "";
  if (fromOrigin && isAllowedAppPublicUrl(fromOrigin, config)) {
    return normalizeOrigin(fromOrigin);
  }

  const referer = req?.headers?.referer;
  if (typeof referer === "string" && referer.trim()) {
    try {
      const fromReferer = normalizeOrigin(new URL(referer.trim()).origin);
      if (isAllowedAppPublicUrl(fromReferer, config)) return fromReferer;
    } catch {
      /* ignore */
    }
  }

  return fallback;
}

/** @deprecated Use resolveAppPublicUrl */
export const resolvePasswordResetAppUrl = resolveAppPublicUrl;
