import type { TemplateModulo } from "./variables";

export type TenantTemplateEntry = {
  conteudo: string;
  nome?: string;
  updatedAt?: string;
};

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
