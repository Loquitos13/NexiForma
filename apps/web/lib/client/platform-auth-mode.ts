import { clearTenantSlug } from "./login-preferences";

/** Query `?platform=1` - login/recuperação da equipa NexiForma (super-admin), sem slug de tenant. */
export const PLATFORM_AUTH_QUERY = "platform";

export function isPlatformAuthMode(params: URLSearchParams): boolean {
  return params.get(PLATFORM_AUTH_QUERY) === "1";
}

export function platformAuthHref(path: "/login" | "/login/recuperar"): string {
  return `${path}?${PLATFORM_AUTH_QUERY}=1`;
}

/**
 * Slug só a partir da URL (`?slug=`). Não reutiliza localStorage.
 */
export function resolveTenantSlugForAuth(
  params: URLSearchParams,
  options: { slugFromUrl?: string; isDev?: boolean },
): string {
  if (isPlatformAuthMode(params)) {
    clearTenantSlug();
    return "";
  }
  const fromUrl = options.slugFromUrl?.trim() || params.get("slug")?.trim() || "";
  clearTenantSlug();
  return fromUrl;
}

export function rememberTenantSlugFromAuth(_slug: string, params: URLSearchParams): void {
  if (isPlatformAuthMode(params)) return;
  clearTenantSlug();
}
