/** Temas pré-definidos da plataforma (escolha pessoal por utilizador). */

export type UiThemeScheme = "dark" | "light";

export type UiThemeId =
  | "midnight"
  | "graphite"
  | "violet-night"
  | "ocean"
  | "forest"
  | "snow-azure"
  | "snow-rose"
  | "snow-emerald"
  | "snow-amber"
  | "snow-violet";

export type UiThemeDef = {
  id: UiThemeId;
  label: string;
  description: string;
  scheme: UiThemeScheme;
  /** Cor de fundo principal (shell) */
  bg: string;
  /** Painéis / cards */
  panel: string;
  /** Texto principal */
  fg: string;
  /** Texto secundário */
  muted: string;
  /** Cor de destaque (botões, links activos) */
  accent: string;
  /** Tom mais claro do accent para hovers / selecção */
  accentSoft: string;
  /** Sidebar */
  sidebar: string;
};

export const UI_THEME_DEFAULT: UiThemeId = "midnight";

export const UI_THEMES: UiThemeDef[] = [
  {
    id: "midnight",
    label: "Meia-noite",
    description: "Azul-marinho com destaque azul",
    scheme: "dark",
    bg: "#070b12",
    panel: "#0f172a",
    fg: "#e8eef7",
    muted: "#94a3b8",
    accent: "#2563eb",
    accentSoft: "#1e3a5f",
    sidebar: "#020617",
  },
  {
    id: "graphite",
    label: "Grafite",
    description: "Carvão com teal luminoso",
    scheme: "dark",
    bg: "#0d1117",
    panel: "#161b22",
    fg: "#f0f3f6",
    muted: "#9aa4b2",
    accent: "#2dd4bf",
    accentSoft: "#0f3d3a",
    sidebar: "#0a0e14",
  },
  {
    id: "violet-night",
    label: "Violeta",
    description: "Noite com roxo",
    scheme: "dark",
    bg: "#0c0a14",
    panel: "#1a1028",
    fg: "#f3e8ff",
    muted: "#a78bfa",
    accent: "#8b5cf6",
    accentSoft: "#4c1d95",
    sidebar: "#09060f",
  },
  {
    id: "ocean",
    label: "Oceano",
    description: "Azul profundo com ciano",
    scheme: "dark",
    bg: "#04141c",
    panel: "#0a2230",
    fg: "#e0f2fe",
    muted: "#7dd3fc",
    accent: "#06b6d4",
    accentSoft: "#155e75",
    sidebar: "#021018",
  },
  {
    id: "forest",
    label: "Floresta",
    description: "Verde escuro com lima",
    scheme: "dark",
    bg: "#07140c",
    panel: "#0f2418",
    fg: "#ecfdf5",
    muted: "#86efac",
    accent: "#22c55e",
    accentSoft: "#14532d",
    sidebar: "#03100a",
  },
  {
    id: "snow-azure",
    label: "Neve azul",
    description: "Claro com azul",
    scheme: "light",
    bg: "#f8fafc",
    panel: "#ffffff",
    fg: "#0f172a",
    muted: "#475569",
    accent: "#2563eb",
    accentSoft: "#dbeafe",
    sidebar: "#ffffff",
  },
  {
    id: "snow-rose",
    label: "Neve rosa",
    description: "Claro com rosa",
    scheme: "light",
    bg: "#fdf4f8",
    panel: "#ffffff",
    fg: "#1e1119",
    muted: "#4a3b45",
    accent: "#e11d48",
    accentSoft: "#ffe4e6",
    sidebar: "#ffffff",
  },
  {
    id: "snow-emerald",
    label: "Neve esmeralda",
    description: "Claro com verde",
    scheme: "light",
    bg: "#f0fdf4",
    panel: "#ffffff",
    fg: "#0f2316",
    muted: "#334f3e",
    accent: "#059669",
    accentSoft: "#d1fae5",
    sidebar: "#ffffff",
  },
  {
    id: "snow-amber",
    label: "Neve âmbar",
    description: "Claro com âmbar",
    scheme: "light",
    bg: "#fffbeb",
    panel: "#ffffff",
    fg: "#20180f",
    muted: "#4d3d2c",
    accent: "#d97706",
    accentSoft: "#fef3c7",
    sidebar: "#ffffff",
  },
  {
    id: "snow-violet",
    label: "Neve violeta",
    description: "Claro com violeta",
    scheme: "light",
    bg: "#f5f3ff",
    panel: "#ffffff",
    fg: "#16122e",
    muted: "#3f3957",
    accent: "#7c3aed",
    accentSoft: "#ede9fe",
    sidebar: "#ffffff",
  },
];

const THEME_BY_ID = Object.fromEntries(UI_THEMES.map((t) => [t.id, t])) as Record<
  UiThemeId,
  UiThemeDef
>;

export function isUiThemeId(value: unknown): value is UiThemeId {
  return typeof value === "string" && value in THEME_BY_ID;
}

export function getUiTheme(id: unknown): UiThemeDef {
  if (isUiThemeId(id)) return THEME_BY_ID[id];
  return THEME_BY_ID[UI_THEME_DEFAULT];
}

export const UI_THEME_STORAGE_KEY = "nexiforma.uiTheme";
/** Utilizador a que pertence o tema em cache (evita herdar tema de outra sessão). */
export const UI_THEME_USER_KEY = "nexiforma.uiThemeUser";

export function clearUiThemeStorage() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(UI_THEME_STORAGE_KEY);
    window.localStorage.removeItem(UI_THEME_USER_KEY);
  } catch {
    /* ignore */
  }
}
