import {
  getModuloTemplates,
  isCustomTemplateId,
  TEMPLATE_TYPES,
  documentPageCss,
  type DocumentOrientacao,
  type DocumentVerticalAlign,
  type TemplateModulo,
} from "@nexiforma/shared";
import { tenantDocumentBrandingCss } from "../common/tenant-logo-embed.util";

const EMITIVEL_MODULOS: TemplateModulo[] = ["formacao", "crm"];

export function isEmitivelTemplateId(templateId: string): boolean {
  if (isCustomTemplateId(templateId)) return true;
  return EMITIVEL_MODULOS.some((mod) =>
    TEMPLATE_TYPES[mod].some((t) => t.id === templateId),
  );
}

export function templateModuloForId(templateId: string): TemplateModulo | null {
  if (isCustomTemplateId(templateId)) {
    return "formacao";
  }
  for (const mod of EMITIVEL_MODULOS) {
    if (TEMPLATE_TYPES[mod].some((t) => t.id === templateId)) return mod;
  }
  return null;
}

export function templateModuloForIdStrict(templateId: string): TemplateModulo | null {
  if (isCustomTemplateId(templateId)) return null;
  for (const mod of EMITIVEL_MODULOS) {
    if (TEMPLATE_TYPES[mod].some((t) => t.id === templateId)) return mod;
  }
  return null;
}

export function templateLabelForId(templateId: string, metadata?: unknown): string {
  if (metadata) {
    for (const mod of EMITIVEL_MODULOS) {
      const nome = getModuloTemplates(metadata, mod)[templateId]?.nome?.trim();
      if (nome) return nome;
    }
  }
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
  opts?: {
    orientacao?: DocumentOrientacao;
    verticalAlign?: DocumentVerticalAlign;
  },
): string {
  if (/<!DOCTYPE\s+html/i.test(bodyHtml) || /<html[\s>]/i.test(bodyHtml)) {
    return bodyHtml;
  }
  return wrapTenantDocumentHtml(title, bodyHtml, metadata, opts);
}

function wrapTenantDocumentHtml(
  title: string,
  bodyHtml: string,
  metadata?: unknown,
  opts?: {
    orientacao?: DocumentOrientacao;
    verticalAlign?: DocumentVerticalAlign;
  },
): string {
  const safeTitle = escapeHtml(title);
  const brandingCss = metadata ? tenantDocumentBrandingCss(metadata) : "";
  const orientacao = opts?.orientacao ?? "portrait";
  const verticalAlign = opts?.verticalAlign ?? "top";
  const pageCss = documentPageCss(orientacao, brandingCss);
  return `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="utf-8" />
  <title>${safeTitle}</title>
  <style>${pageCss}</style>
</head>
<body>
  <div class="doc-page-shell">
    <div class="doc-page-body" data-v-align="${verticalAlign}">
      <div class="doc-content-layer">
${bodyHtml}
      </div>
    </div>
  </div>
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
