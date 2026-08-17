import { TEMPLATE_TYPES, type TemplateModulo } from "./variables";
import {
  parseDocumentLogoPlacements,
  type DocumentLogoPlacement,
} from "./module-logos.util";
import type { DocumentOrientacao, DocumentVerticalAlign } from "./document-page.util";

export type TemplateFormato = "texto" | "html";

export type TenantTemplateEntry = {
  conteudo: string;
  nome?: string;
  updatedAt?: string;
  custom?: boolean;
  formato?: TemplateFormato;
  logos?: DocumentLogoPlacement[];
  orientacao?: DocumentOrientacao;
  alinhamentoVertical?: DocumentVerticalAlign;
};

export const CUSTOM_TEMPLATE_ID_PREFIX = "custom_";

export function isCustomTemplateId(id: string): boolean {
  return id.startsWith(CUSTOM_TEMPLATE_ID_PREFIX);
}

/** Gera ID único e seguro para template personalizado. */
export function slugifyTemplateId(nome: string): string {
  const base = nome
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 60);
  const suffix = Date.now().toString(36).slice(-6);
  return `${CUSTOM_TEMPLATE_ID_PREFIX}${base || "template"}_${suffix}`;
}

export function isAllowedTemplateId(modulo: TemplateModulo, id: string): boolean {
  if ((TEMPLATE_TYPES[modulo] ?? []).some((t) => t.id === id)) return true;
  return /^custom_[a-z0-9][a-z0-9_]{0,89}$/.test(id);
}

export function listEmitivelTemplateOptions(
  saved: Record<string, TenantTemplateEntry>,
): Array<{ id: string; label: string }> {
  const catalog = TEMPLATE_TYPES.formacao;
  const options = catalog.map((t) => ({
    id: t.id,
    label: saved[t.id]?.nome?.trim() || t.label,
  }));
  for (const [id, entry] of Object.entries(saved)) {
    if (catalog.some((t) => t.id === id)) continue;
    if (entry.custom || isCustomTemplateId(id)) {
      options.push({ id, label: entry.nome?.trim() || id });
    }
  }
  return options;
}

export type TenantDocumentTemplates = {
  version: 1;
  modulos: Partial<Record<TemplateModulo, Record<string, TenantTemplateEntry>>>;
};

export function emptyTenantDocumentTemplates(): TenantDocumentTemplates {
  return { version: 1, modulos: {} };
}

export function parseTenantDocumentTemplates(raw: unknown): TenantDocumentTemplates {
  if (!raw || typeof raw !== "object") return emptyTenantDocumentTemplates();
  const o = raw as Partial<TenantDocumentTemplates>;
  if (o.version !== 1 || !o.modulos || typeof o.modulos !== "object") {
    return emptyTenantDocumentTemplates();
  }
  const modulos: TenantDocumentTemplates["modulos"] = {};
  for (const [mod, entries] of Object.entries(o.modulos)) {
    if (!entries || typeof entries !== "object") continue;
    const clean: Record<string, TenantTemplateEntry> = {};
    for (const [id, entry] of Object.entries(entries)) {
      if (!entry || typeof entry !== "object") continue;
      const e = entry as TenantTemplateEntry;
      if (typeof e.conteudo !== "string") continue;
      clean[id] = {
        conteudo: e.conteudo,
        ...(typeof e.nome === "string" ? { nome: e.nome } : {}),
        ...(typeof e.updatedAt === "string" ? { updatedAt: e.updatedAt } : {}),
        ...(e.custom === true ? { custom: true } : {}),
        ...(e.formato === "texto" || e.formato === "html" ? { formato: e.formato } : {}),
        ...(e.orientacao === "portrait" || e.orientacao === "landscape"
          ? { orientacao: e.orientacao }
          : {}),
        ...(e.alinhamentoVertical === "top" ||
        e.alinhamentoVertical === "middle" ||
        e.alinhamentoVertical === "bottom"
          ? { alinhamentoVertical: e.alinhamentoVertical }
          : {}),
        ...(e.logos?.length ? { logos: parseDocumentLogoPlacements(e.logos) } : {}),
      };
    }
    modulos[mod as TemplateModulo] = clean;
  }
  return { version: 1, modulos };
}

export function mergeTenantDocumentTemplates(
  metadata: unknown,
  modulo: TemplateModulo,
  templates: Record<string, TenantTemplateEntry>,
): Record<string, unknown> {
  const meta =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? { ...(metadata as Record<string, unknown>) }
      : {};
  const current = parseTenantDocumentTemplates(meta.documentTemplates);
  return {
    ...meta,
    documentTemplates: {
      version: 1 as const,
      modulos: {
        ...current.modulos,
        [modulo]: templates,
      },
    },
  };
}

export function getModuloTemplates(
  metadata: unknown,
  modulo: TemplateModulo,
): Record<string, TenantTemplateEntry> {
  return parseTenantDocumentTemplates(
    metadata && typeof metadata === "object"
      ? (metadata as Record<string, unknown>).documentTemplates
      : undefined,
  ).modulos[modulo] ?? {};
}
