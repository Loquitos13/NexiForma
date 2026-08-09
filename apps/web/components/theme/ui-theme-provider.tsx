"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { bffFetch } from "@/lib/client/bff-fetch";
import {
  persistUiTheme,
  syncUiThemeFromServer,
  UI_THEME_SYNCED_EVENT,
  type UiThemeSyncedDetail,
} from "@/lib/client/ui-theme-sync";
import {
  getUiTheme,
  isUiThemeId,
  UI_THEME_DEFAULT,
  UI_THEME_STORAGE_KEY,
  type UiThemeDef,
  type UiThemeId,
} from "@/lib/ui/ui-themes";

type UiThemeContextValue = {
  themeId: UiThemeId;
  theme: UiThemeDef;
  setThemeId: (id: UiThemeId) => void;
  shopOpen: boolean;
  openShop: () => void;
  closeShop: () => void;
  ready: boolean;
};

const UiThemeContext = createContext<UiThemeContextValue | null>(null);

function readBootTheme(): UiThemeId {
  if (typeof window === "undefined") return UI_THEME_DEFAULT;
  try {
    const stored = window.localStorage.getItem(UI_THEME_STORAGE_KEY);
    if (isUiThemeId(stored)) return stored;
  } catch {
    /* ignore */
  }
  return UI_THEME_DEFAULT;
}

export function UiThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeIdState] = useState<UiThemeId>(readBootTheme);
  const [shopOpen, setShopOpen] = useState(false);
  const [userKey, setUserKey] = useState<string>("");
  const [ready, setReady] = useState(false);
  /** Incrementado em setThemeId - syncs com gen inferior não revertem a escolha. */
  const localChoiceGen = useRef(0);
  const syncEpoch = useRef(0);

  useEffect(() => {
    let cancelled = false;

    const runSync = async () => {
      const epoch = ++syncEpoch.current;
      const choiceAtStart = localChoiceGen.current;
      await syncUiThemeFromServer();
      if (cancelled) return;
      if (localChoiceGen.current === choiceAtStart && epoch === syncEpoch.current) {
        setReady(true);
      }
    };

    void runSync();

    const onSynced = (ev: Event) => {
      if (cancelled) return;
      const detail = (ev as CustomEvent<UiThemeSyncedDetail>).detail;
      if (!detail || !isUiThemeId(detail.themeId)) return;
      // Escolha local mais recente que este sync → não reverter.
      // syncEpoch: o emit é síncrono no fim de syncUiThemeFromServer, na mesma stack
      // que o await; localChoiceGen só muda em setThemeId.
      setThemeIdState(detail.themeId);
      if (detail.userKey) setUserKey(detail.userKey);
      setReady(true);
    };

    window.addEventListener(UI_THEME_SYNCED_EVENT, onSynced);
    return () => {
      cancelled = true;
      window.removeEventListener(UI_THEME_SYNCED_EVENT, onSynced);
    };
  }, []);

  const setThemeId = useCallback(
    (id: UiThemeId) => {
      localChoiceGen.current += 1;
      setThemeIdState(id);
      persistUiTheme(id, userKey || undefined);

      void (async () => {
        try {
          const res = await bffFetch("/api/auth/preferences", {
            method: "PATCH",
            headers: { "Content-Type": "application/json", accept: "application/json" },
            body: JSON.stringify({ uiTheme: id }),
          });
          if (!res.ok) {
            console.warn("[ui-theme] falha ao gravar preferência", res.status);
            return;
          }
          const data = (await res.json()) as { uiTheme?: string | null };
          if (isUiThemeId(data.uiTheme)) {
            setThemeIdState(data.uiTheme);
            persistUiTheme(data.uiTheme, userKey || undefined);
          }
        } catch (err) {
          console.warn("[ui-theme] erro de rede ao gravar preferência", err);
        }
      })();
    },
    [userKey],
  );

  const value = useMemo<UiThemeContextValue>(
    () => ({
      themeId,
      theme: getUiTheme(themeId),
      setThemeId,
      shopOpen,
      openShop: () => setShopOpen(true),
      closeShop: () => setShopOpen(false),
      ready,
    }),
    [themeId, setThemeId, shopOpen, ready],
  );

  return <UiThemeContext.Provider value={value}>{children}</UiThemeContext.Provider>;
}

export function useUiTheme() {
  const ctx = useContext(UiThemeContext);
  if (!ctx) {
    throw new Error("useUiTheme deve ser usado dentro de UiThemeProvider");
  }
  return ctx;
}

export function useUiThemeOptional() {
  return useContext(UiThemeContext);
}
