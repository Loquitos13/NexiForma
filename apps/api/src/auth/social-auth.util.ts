export type SocialProvider = "google" | "microsoft";

export type TenantSocialLoginConfig = {
  google?: boolean;
  microsoft?: boolean;
};

export type TenantMetadataWithSocialLogin = {
  socialLogin?: TenantSocialLoginConfig;
};

export const SOCIAL_PROVIDER_LABELS: Record<SocialProvider, string> = {
  google: "Google",
  microsoft: "Microsoft",
};

export const SOCIAL_PROVIDER_ISSUERS: Record<SocialProvider, string> = {
  google: "https://accounts.google.com",
  microsoft: "https://login.microsoftonline.com/common/v2.0",
};

export const SOCIAL_PROVIDER_SCOPES: Record<SocialProvider, string[]> = {
  google: ["openid", "profile", "email"],
  microsoft: ["openid", "profile", "email"],
};

export function readTenantSocialLogin(metadata: unknown): TenantSocialLoginConfig {
  const meta = (metadata ?? {}) as TenantMetadataWithSocialLogin;
  return meta.socialLogin ?? {};
}

export function isSocialProviderEnabled(
  provider: SocialProvider,
  metadata: unknown,
  platformConfigured: boolean,
): boolean {
  if (!platformConfigured) return false;
  const cfg = readTenantSocialLogin(metadata);
  if (provider === "google") return cfg.google !== false;
  return cfg.microsoft !== false;
}

export const OAUTH_EXCHANGE_JWT_PURPOSE = "oauth_exchange";
export const OAUTH_TENANT_PICK_JWT_PURPOSE = "oauth_tenant_pick";

/** Email no id_token (Microsoft pode usar preferred_username/upn). */
export function extractOAuthEmail(claims: Record<string, unknown>): string {
  const candidates = [claims.email, claims.preferred_username, claims.upn];
  for (const raw of candidates) {
    const value = String(raw ?? "").trim().toLowerCase();
    if (value.includes("@")) return value;
  }
  return "";
}

/** Origem segura para redireccionar de volta ao frontend após OAuth. */
export function resolveOAuthReturnOrigin(
  raw: string | undefined,
  fallback: string,
  allowDevLan = process.env.NODE_ENV !== "production",
): string {
  const fb = fallback.replace(/\/$/, "");
  const input = raw?.trim();
  if (!input) return fb;

  try {
    const u = new URL(input);
    if (u.protocol !== "http:" && u.protocol !== "https:") return fb;

    const allowedOrigins = new Set<string>([new URL(fb).origin]);
    const appPublic = process.env.APP_PUBLIC_URL?.trim().replace(/\/$/, "");
    if (appPublic) {
      allowedOrigins.add(new URL(appPublic).origin);
    }
    for (const host of ["http://localhost:3000", "http://127.0.0.1:3000"]) {
      allowedOrigins.add(new URL(host).origin);
    }
    if (allowedOrigins.has(u.origin)) return u.origin;

    if (
      allowDevLan &&
      /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(?::\d+)?$/i.test(
        u.origin,
      )
    ) {
      return u.origin;
    }
    if (allowDevLan && /\.ngrok-free\.dev$/i.test(u.hostname)) {
      return u.origin;
    }
  } catch {
    /* URL inválida */
  }
  return fb;
}
