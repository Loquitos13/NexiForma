import type { TemplateModulo } from "./variables";

export type ModuleLogoAsset = {
  id: string;
  nome: string;
  storageKey: string;
  createdAt?: string;
};

export type DocumentLogoZona = "cabecalho" | "rodape" | "marca_agua" | "corpo";

export type DocumentLogoPlacement = {
  logoId: string;
  zona: DocumentLogoZona;
  posicao?: "left" | "center" | "right";
  larguraPx?: number;
  alturaPx?: number;
  /** Posição horizontal na página (0–100 %). */
  xPct?: number;
  /** Posição vertical na página (0–100 %). */
  yPct?: number;
  /** 0–1; marca d'água usa ~0.15–0.25 por omissão */
  opacidade?: number;
  ordem?: number;
};

export type TenantModuleLogos = {
  version: 1;
  modulos: Partial<Record<TemplateModulo, ModuleLogoAsset[]>>;
};

export function emptyTenantModuleLogos(): TenantModuleLogos {
  return { version: 1, modulos: {} };
}

export function parseTenantModuleLogos(raw: unknown): TenantModuleLogos {
  if (!raw || typeof raw !== "object") return emptyTenantModuleLogos();
  const o = raw as Partial<TenantModuleLogos>;
  if (o.version !== 1 || !o.modulos || typeof o.modulos !== "object") {
    return emptyTenantModuleLogos();
  }
  const modulos: TenantModuleLogos["modulos"] = {};
  for (const [mod, logos] of Object.entries(o.modulos)) {
    if (!Array.isArray(logos)) continue;
    const clean: ModuleLogoAsset[] = [];
    for (const item of logos) {
      if (!item || typeof item !== "object") continue;
      const l = item as ModuleLogoAsset;
      if (typeof l.id !== "string" || typeof l.nome !== "string" || typeof l.storageKey !== "string") {
        continue;
      }
      clean.push({
        id: l.id,
        nome: l.nome.slice(0, 120),
        storageKey: l.storageKey,
        ...(typeof l.createdAt === "string" ? { createdAt: l.createdAt } : {}),
      });
    }
    modulos[mod as TemplateModulo] = clean;
  }
  return { version: 1, modulos };
}

export function getModuloLogos(metadata: unknown, modulo: TemplateModulo): ModuleLogoAsset[] {
  const meta =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : {};
  return parseTenantModuleLogos(meta.moduleLogos).modulos[modulo] ?? [];
}

export function mergeTenantModuleLogos(
  metadata: unknown,
  modulo: TemplateModulo,
  logos: ModuleLogoAsset[],
): Record<string, unknown> {
  const meta =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? { ...(metadata as Record<string, unknown>) }
      : {};
  const current = parseTenantModuleLogos(meta.moduleLogos);
  return {
    ...meta,
    moduleLogos: {
      version: 1 as const,
      modulos: {
        ...current.modulos,
        [modulo]: logos,
      },
    },
  };
}

export function slugifyModuleLogoId(nome: string): string {
  const base = nome
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `${base || "logo"}-${Date.now().toString(36).slice(-6)}`;
}

export function parseDocumentLogoPlacements(raw: unknown): DocumentLogoPlacement[] {
  if (!Array.isArray(raw)) return [];
  const out: DocumentLogoPlacement[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const p = item as DocumentLogoPlacement;
    if (typeof p.logoId !== "string") continue;
    const zona = p.zona;
    if (zona !== "cabecalho" && zona !== "rodape" && zona !== "marca_agua" && zona !== "corpo") {
      continue;
    }
    out.push({
      logoId: p.logoId,
      zona,
      ...(p.posicao === "left" || p.posicao === "center" || p.posicao === "right"
        ? { posicao: p.posicao }
        : {}),
      ...(typeof p.larguraPx === "number" ? { larguraPx: clampPx(p.larguraPx, 24, 480) } : {}),
      ...(typeof p.alturaPx === "number" ? { alturaPx: clampPx(p.alturaPx, 16, 320) } : {}),
      ...(typeof p.opacidade === "number" ? { opacidade: clampOpacity(p.opacidade) } : {}),
      ...(typeof p.ordem === "number" ? { ordem: p.ordem } : {}),
      ...(typeof p.xPct === "number" ? { xPct: clampPct(p.xPct) } : {}),
      ...(typeof p.yPct === "number" ? { yPct: clampPct(p.yPct) } : {}),
    });
  }
  return out.sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
}

function clampPx(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function clampOpacity(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.min(1, Math.max(0.05, n));
}

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, Math.round(n * 10) / 10));
}

export function defaultLogoOpacity(zona: DocumentLogoZona): number {
  return zona === "marca_agua" ? 0.2 : 1;
}

/** Coordenadas por omissão ao adicionar logo no canvas (percentagem A4). */
export function defaultLogoPlacementCoords(
  zona: DocumentLogoZona,
  index: number,
): { xPct: number; yPct: number } {
  switch (zona) {
    case "cabecalho":
      return { xPct: clampPct(4 + index * 22), yPct: 3 };
    case "rodape":
      return { xPct: clampPct(4 + index * 22), yPct: 88 };
    case "marca_agua":
      return { xPct: 32, yPct: 40 };
    default:
      return { xPct: clampPct(8 + index * 12), yPct: clampPct(12 + index * 8) };
  }
}

export function normalizeLogoPlacement(
  p: DocumentLogoPlacement,
  index: number,
): DocumentLogoPlacement {
  const hasCoords = typeof p.xPct === "number" && typeof p.yPct === "number";
  const defaults = defaultLogoPlacementCoords(p.zona, index);
  return {
    ...p,
    xPct: hasCoords ? p.xPct : defaults.xPct,
    yPct: hasCoords ? p.yPct : defaults.yPct,
    larguraPx: p.larguraPx ?? (p.zona === "marca_agua" ? 240 : 140),
    alturaPx: p.alturaPx ?? (p.zona === "marca_agua" ? 100 : 48),
    opacidade: p.opacidade ?? defaultLogoOpacity(p.zona),
  };
}
