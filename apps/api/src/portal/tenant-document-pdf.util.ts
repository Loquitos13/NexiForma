import {
  getModuloTemplates,
  TEMPLATE_TYPES,
  type TemplateModulo,
} from "@nexiforma/shared";
import { tenantDocumentBrandingCss } from "../common/tenant-logo-embed.util";

const EMITIVEL_MODULOS: TemplateModulo[] = ["formacao"];

export function isEmitivelTemplateId(templateId: string): boolean {
  return EMITIVEL_MODULOS.some((mod) =>
    TEMPLATE_TYPES[mod].some((t) => t.id === templateId),
  );
}

export function templateModuloForId(templateId: string): TemplateModulo | null {
  for (const mod of EMITIVEL_MODULOS) {
    if (TEMPLATE_TYPES[mod].some((t) => t.id === templateId)) return mod;
  }
  return null;
}

export function templateLabelForId(templateId: string): string {
  for (const mod of EMITIVEL_MODULOS) {
    const hit = TEMPLATE_TYPES[mod].find((t) => t.id === templateId);
    if (hit) return hit.label;
  }
  return templateId;
}

/** Conteúdo guardado pelo tenant ou default do catálogo. */
export function resolveTenantTemplateContent(
  metadata: unknown,
  modulo: TemplateModulo,
  templateId: string,
): string {
  const saved = getModuloTemplates(metadata, modulo)[templateId]?.conteudo?.trim();
  if (saved) return saved;
  return TEMPLATE_TYPES[modulo].find((t) => t.id === templateId)?.conteudoDefault?.trim() ?? "";
}

/** Envolve fragmento HTML num documento A4 imprimível. */
export function ensureFullDocumentHtml(
  title: string,
  bodyHtml: string,
  metadata?: unknown,
): string {
  if (/<!DOCTYPE\s+html/i.test(bodyHtml) || /<html[\s>]/i.test(bodyHtml)) {
    return bodyHtml;
  }
  return wrapTenantDocumentHtml(title, bodyHtml, metadata);
}

function wrapTenantDocumentHtml(title: string, bodyHtml: string, metadata?: unknown): string {
  const safeTitle = escapeHtml(title);
  const brandingCss = metadata ? tenantDocumentBrandingCss(metadata) : "";
  return `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="utf-8" />
  <title>${safeTitle}</title>
  <style>
    body { font-family: Georgia, "Times New Roman", serif; color: #111; line-height: 1.45; padding: 24px; font-size: 13px; }
    h1, h2, h3 { margin: 16px 0 8px; }
    p { margin: 0 0 10px; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; }
    ${brandingCss}
  </style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
