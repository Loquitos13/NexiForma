import { clearTenantSlug, getSavedTenantSlug, persistTenantSlug } from "./login-preferences";

/** Query `?platform=1` - login/recuperação da equipa NexiForma (super-admin), sem slug de tenant. */
export const PLATFORM_AUTH_QUERY = "platform";

export function isPlatformAuthMode(params: URLSearchParams): boolean {
  return params.get(PLATFORM_AUTH_QUERY) === "1";
}

export function platformAuthHref(path: "/login" | "/login/recuperar"): string {
  return `${path}?${PLATFORM_AUTH_QUERY}=1`;
}

/** Limpa slug guardado e devolve string vazia para login de plataforma. */
export function resolveTenantSlugForAuth(
  params: URLSearchParams,
  options: { slugFromUrl?: string; isDev?: boolean },
): string {
  if (isPlatformAuthMode(params)) {
    clearTenantSlug();
    return "";
  }
  const fromUrl = options.slugFromUrl?.trim() ?? "";
  if (fromUrl) return fromUrl;
  const saved = getSavedTenantSlug();
  if (saved) return saved;
  if (options.isDev) return "demo";
  return "";
}

export function rememberTenantSlugFromAuth(slug: string, params: URLSearchParams): void {
  if (!slug.trim() || isPlatformAuthMode(params)) return;
  persistTenantSlug(slug);
}
