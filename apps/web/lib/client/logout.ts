import { setAccessToken } from "./access-token";
import { clearClientRateLimitBlock } from "./rate-limit-client";
import { clearPersistedTenantContext } from "./login-preferences";
import { clearUiThemeStorage, UI_THEME_DEFAULT, getUiTheme } from "@/lib/ui/ui-themes";

/** Aplica meia-noite no DOM (só quando já saímos da UI autenticada). */
export function resetDocumentThemeToDefault() {
  if (typeof document === "undefined") return;
  const theme = getUiTheme(UI_THEME_DEFAULT);
  document.documentElement.setAttribute("data-ui-theme", theme.id);
  document.documentElement.setAttribute("data-ui-scheme", theme.scheme);
}

type PurgeOpts = {
  /**
   * Se true, pinta meia-noite no DOM (ex.: limpeza na página de login).
   * No logout normal fica false para não flashar o tema enquanto "A sair…".
   */
  resetThemePaint?: boolean;
};

/** Revoga sessão no servidor e limpa credenciais locais (logout ou login limpo). */
export async function purgeStaleAuthSession(opts?: PurgeOpts): Promise<void> {
  setAccessToken(null);
  clearClientRateLimitBlock();
  clearPersistedTenantContext();
  // Limpa cache do tema (não herdar noutro login), mas não pinta midnight por defeito.
  clearUiThemeStorage();
  if (opts?.resetThemePaint) {
    resetDocumentThemeToDefault();
  }
  try {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    /* rede indisponível */
  }
}

/** Logout explícito: mantém o tema visual até a navegação sair do portal. */
export async function logoutSession(): Promise<void> {
  try {
    await purgeStaleAuthSession({ resetThemePaint: false });
  } finally {
    setAccessToken(null);
    clearPersistedTenantContext();
    clearUiThemeStorage();
  }
}
