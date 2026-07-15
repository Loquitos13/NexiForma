import type { ConfigService } from "@nestjs/config";
import type { Response } from "express";
import { API_PREFIX } from "@nexiforma/shared";

/** Nome da cookie HttpOnly com o opaque refresh token. */
export const REFRESH_COOKIE_NAME = "nexiforma_refresh";

export function computeAuthCookiePath(): string {
  const override = process.env.AUTH_COOKIE_PATH?.trim();
  if (override) {
    return override.startsWith("/") ? override : `/${override}`;
  }
  return `/${API_PREFIX}/auth`;
}

function cookieSecure(config?: ConfigService): boolean {
  if (!config) return false;
  const isProd = config.get<string>("NODE_ENV") === "production";
  return (
    config.get<string>("COOKIE_SECURE") === "true" ||
    config.get<string>("COOKIE_SECURE") === "1" ||
    isProd
  );
}

function cookieSameSite(config?: ConfigService): "strict" | "lax" | "none" {
  if (!config) return "lax";
  const ss = config.get<string>("COOKIE_SAMESITE")?.toLowerCase();
  if (ss === "strict" || ss === "lax" || ss === "none") {
    return ss;
  }
  // Produção: strict reduz envio de cookie em navegação cross-site (MITM/CSRF).
  if (config.get<string>("NODE_ENV") === "production") {
    return "strict";
  }
  return "lax";
}

export function attachRefreshCookie(
  res: Response,
  config: ConfigService,
  opaque: string,
  maxAgeSec: number,
): void {
  res.cookie(REFRESH_COOKIE_NAME, opaque, {
    httpOnly: true,
    secure: cookieSecure(config),
    sameSite: cookieSameSite(config),
    path: computeAuthCookiePath(),
    maxAge: maxAgeSec * 1000,
  });
}

export function clearRefreshCookie(res: Response, config?: ConfigService): void {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    path: computeAuthCookiePath(),
    httpOnly: true,
    secure: cookieSecure(config),
    sameSite: cookieSameSite(config),
  });
}
