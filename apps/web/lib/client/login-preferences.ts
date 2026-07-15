const REMEMBER_KEY = "nexiforma_login_remember";
const SLUG_KEY = "nexiforma_login_tenant_slug";
const EMAIL_KEY = "nexiforma_login_email";

function read(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* storage indisponível */
  }
}

/** Utilizador activou «Memorizar sessão» no último login. */
export function getRememberLogin(): boolean {
  return read(REMEMBER_KEY) === "1";
}

export function setRememberLogin(remember: boolean): void {
  write(REMEMBER_KEY, remember ? "1" : "0");
}

/** Slug do tenant - persistido sempre que conhecido (convite, URL, login). */
export function getSavedTenantSlug(): string {
  return read(SLUG_KEY)?.trim() ?? "";
}

export function persistTenantSlug(slug: string): void {
  const clean = slug.trim().toLowerCase();
  if (clean) write(SLUG_KEY, clean);
}

/** Login equipa NexiForma - não reutilizar slug de tenant guardado. */
export function clearTenantSlug(): void {
  write(SLUG_KEY, null);
}

/** Email guardado apenas quando «Memorizar» está activo. */
export function getSavedEmail(): string {
  if (!getRememberLogin()) return "";
  return read(EMAIL_KEY)?.trim() ?? "";
}

export function persistLoginPreferences(input: {
  remember: boolean;
  tenantSlug: string;
  email: string;
}): void {
  setRememberLogin(input.remember);
  persistTenantSlug(input.tenantSlug);
  if (input.remember) {
    write(EMAIL_KEY, input.email.trim().toLowerCase());
  } else {
    write(EMAIL_KEY, null);
  }
}
