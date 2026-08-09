import { bffFetch } from "@/lib/client/bff-fetch";
import {
  clearUiThemeStorage,
  getUiTheme,
  isUiThemeId,
  UI_THEME_DEFAULT,
  UI_THEME_STORAGE_KEY,
  UI_THEME_USER_KEY,
  type UiThemeId,
} from "@/lib/ui/ui-themes";

/** Disparado após sync bem-sucedido (provider actualiza estado React). */
export const UI_THEME_SYNCED_EVENT = "nexiforma:ui-theme-synced";

export type UiThemeSyncedDetail = {
  themeId: UiThemeId;
  userKey: string;
};

function themeUserKey(me: { id?: string; sub?: string; email?: string | null }) {
  return String(me.id || me.sub || me.email || "").trim();
}

export function paintUiTheme(id: UiThemeId) {
  if (typeof document === "undefined") return;
  const theme = getUiTheme(id);
  document.documentElement.setAttribute("data-ui-theme", theme.id);
  document.documentElement.setAttribute("data-ui-scheme", theme.scheme);
}

export function persistUiTheme(id: UiThemeId, userKey?: string) {
  paintUiTheme(id);
  try {
    window.localStorage.setItem(UI_THEME_STORAGE_KEY, id);
    if (userKey) window.localStorage.setItem(UI_THEME_USER_KEY, userKey);
  } catch {
    /* ignore */
  }
}

function readLocalThemeForUser(userKey: string): UiThemeId | null {
  try {
    const storedUser = window.localStorage.getItem(UI_THEME_USER_KEY) || "";
    const storedTheme = window.localStorage.getItem(UI_THEME_STORAGE_KEY);
    if (storedUser && storedUser === userKey && isUiThemeId(storedTheme)) {
      return storedTheme;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function emitSynced(themeId: UiThemeId, userKey: string) {
  if (typeof window === "undefined") return;
  const detail: UiThemeSyncedDetail = { themeId, userKey };
  window.dispatchEvent(new CustomEvent(UI_THEME_SYNCED_EVENT, { detail }));
}

/**
 * Busca o tema em `/api/auth/me` (uiPreferences), pinta o DOM e grava cache.
 * Chamar **antes** de navegar pós-login para o skeleton já nascer com a cor certa.
 */
export async function syncUiThemeFromServer(): Promise<UiThemeId> {
  // Optimista: se houver cache local, pintar já (evita flash midnight).
  try {
    const cached = window.localStorage.getItem(UI_THEME_STORAGE_KEY);
    if (isUiThemeId(cached)) paintUiTheme(cached);
  } catch {
    /* ignore */
  }

  const res = await bffFetch("/api/auth/me", { headers: { accept: "application/json" } });
  if (!res.ok) {
    clearUiThemeStorage();
    paintUiTheme(UI_THEME_DEFAULT);
    emitSynced(UI_THEME_DEFAULT, "");
    return UI_THEME_DEFAULT;
  }

  const me = (await res.json()) as {
    id?: string;
    sub?: string;
    email?: string | null;
    uiTheme?: string | null;
  };
  const key = themeUserKey(me);

  if (isUiThemeId(me.uiTheme)) {
    persistUiTheme(me.uiTheme, key);
    emitSynced(me.uiTheme, key);
    return me.uiTheme;
  }

  const localTheme = readLocalThemeForUser(key);
  if (localTheme) {
    persistUiTheme(localTheme, key);
    void bffFetch("/api/auth/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({ uiTheme: localTheme }),
    }).catch(() => undefined);
    emitSynced(localTheme, key);
    return localTheme;
  }

  clearUiThemeStorage();
  persistUiTheme(UI_THEME_DEFAULT, key);
  emitSynced(UI_THEME_DEFAULT, key);
  return UI_THEME_DEFAULT;
}
