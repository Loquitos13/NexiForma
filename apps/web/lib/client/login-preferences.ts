const REMEMBER_KEY = "nexiforma_login_remember";
/** Chave legada - já não se usa para auth; só se limpa. */
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

/**
 * Slug já não é lido do storage (evita «Entidade seleccionada inválida» ao mudar de email).
 * A entidade vem só de `?slug=` na URL ou da escolha explícita no modal.
 */
export function getSavedTenantSlug(): string {
  return "";
}

/** Limpa resíduos antigos; não grava slug para auth. */
export function persistTenantSlug(_slug?: string): void {
  clearTenantSlug();
}

export function clearTenantSlug(): void {
  write(SLUG_KEY, null);
}

/** Remove slug residual após logout / ecrã de login. */
export function clearPersistedTenantContext(): void {
  clearTenantSlug();
}

/** Email guardado apenas quando «Memorizar» está activo. */
export function getSavedEmail(): string {
  if (!getRememberLogin()) return "";
  return read(EMAIL_KEY)?.trim() ?? "";
}

export function persistLoginPreferences(input: {
  remember: boolean;
  tenantSlug?: string;
  email: string;
}): void {
  setRememberLogin(input.remember);
  // Nunca guardar slug - resolve-se no login (email / picker / ?slug=).
  clearTenantSlug();
  if (input.remember) {
    write(EMAIL_KEY, input.email.trim().toLowerCase());
  } else {
    write(EMAIL_KEY, null);
  }
}
