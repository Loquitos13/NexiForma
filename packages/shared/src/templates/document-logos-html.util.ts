import {
  defaultLogoOpacity,
  normalizeLogoPlacement,
  type DocumentLogoPlacement,
} from "./module-logos.util";

export type ResolvedDocumentLogo = DocumentLogoPlacement & {
  dataUri: string;
  nome?: string;
};

function logoImgStyleAbs(p: DocumentLogoPlacement): string {
  const w = p.larguraPx ?? (p.zona === "marca_agua" ? 240 : 140);
  const h = p.alturaPx ?? (p.zona === "marca_agua" ? 100 : 48);
  const opacity = p.opacidade ?? defaultLogoOpacity(p.zona);
  const x = p.xPct ?? 0;
  const y = p.yPct ?? 0;
  return `position:absolute;left:${x}%;top:${y}%;width:${w}px;height:${h}px;object-fit:contain;opacity:${opacity};`;
}

function absoluteLogoHtml(p: ResolvedDocumentLogo): string {
  const src = p.dataUri.trim();
  if (!src.startsWith("data:") && !src.startsWith("http://") && !src.startsWith("https://")) {
    return "";
  }
  const alt = escapeAttr(p.nome ?? "Logo");
  return `<img class="doc-logo-abs doc-logo-${p.zona}" src="${src}" alt="${alt}" style="${logoImgStyleAbs(p)}" />`;
}

/** CSS base para documentos com logos posicionados. */
export function documentLogosCss(): string {
  return `
    .doc-page-shell { position: relative; }
    .doc-page-canvas-back { position: absolute; inset: 0; pointer-events: none; z-index: 0; }
    .doc-page-canvas-front { position: absolute; inset: 0; pointer-events: none; z-index: 2; }
    .doc-page-canvas { position: absolute; inset: 0; pointer-events: none; z-index: 0; }
    .doc-page-body { position: relative; z-index: 1; }
    .doc-content-layer { position: relative; z-index: 1; }
    .doc-logo-abs { pointer-events: none; }
  `.trim();
}

function logoLayersHtml(logos: ResolvedDocumentLogo[]): { back: string; front: string } {
  const normalized = logos.map((l, i) => ({
    ...l,
    ...normalizeLogoPlacement(l, i),
  }));
  const back = normalized
    .filter((l) => l.zona === "marca_agua")
    .map(absoluteLogoHtml)
    .filter(Boolean)
    .join("");
  const front = normalized
    .filter((l) => l.zona !== "marca_agua")
    .map(absoluteLogoHtml)
    .filter(Boolean)
    .join("");
  return { back, front };
}

function injectLogoLayers(html: string, back: string, front: string): string {
  let out = html
    .replace(/<div class="doc-page-canvas-back">[\s\S]*?<\/div>/i, "")
    .replace(/<div class="doc-page-canvas-front">[\s\S]*?<\/div>/i, "")
    .replace(/<div class="doc-page-canvas">[\s\S]*?<\/div>/i, "");

  const backLayer = back ? `<div class="doc-page-canvas-back">${back}</div>` : "";
  const frontLayer = front ? `<div class="doc-page-canvas-front">${front}</div>` : "";

  if (/class="doc-page-shell"/.test(out)) {
    out = out.replace(/(<div class="doc-page-shell"[^>]*>)/i, `$1${backLayer}`);
    if (frontLayer) {
      out = injectFrontBeforeBodyClose(out, frontLayer);
    }
    return out;
  }

  if (/doc-content-layer/.test(out)) {
    return `${backLayer}<div class="doc-content-layer">${out}</div>${frontLayer}`;
  }

  return `<div class="doc-page-shell">${backLayer}<div class="doc-content-layer">${out}</div>${frontLayer}</div>`;
}

/** Insere camada frontal antes do fecho de doc-page-body (2.º </div> antes de </body>). */
function injectFrontBeforeBodyClose(html: string, frontLayer: string): string {
  const bodyIdx = html.lastIndexOf("</body>");
  if (bodyIdx === -1) return html + frontLayer;

  let searchEnd = bodyIdx;
  let closes = 0;
  let insertAt = -1;
  while (searchEnd > 0 && closes < 2) {
    const divClose = html.lastIndexOf("</div>", searchEnd - 1);
    if (divClose === -1) break;
    closes += 1;
    if (closes === 2) insertAt = divClose;
    searchEnd = divClose;
  }

  if (insertAt === -1) {
    return html.replace(/(<\/body>)/i, `${frontLayer}$1`);
  }
  return html.slice(0, insertAt) + frontLayer + html.slice(insertAt);
}

/**
 * Injeta logos resolvidos (data-URI) no HTML do documento com posicionamento absoluto (xPct/yPct).
 */
export function applyDocumentLogosToHtml(html: string, logos: ResolvedDocumentLogo[]): string {
  if (!html.trim() || !logos.length) return html;

  const { back, front } = logoLayersHtml(logos);
  if (!back && !front) return html;

  const css = documentLogosCss();
  let out = html;

  if (css && !/doc-page-canvas-back/.test(out) && !/doc-page-canvas-front/.test(out)) {
    if (/<head[^>]*>/i.test(out)) {
      out = out.replace(/<head([^>]*)>/i, `<head$1><style>${css}</style>`);
    } else if (/<html[^>]*>/i.test(out)) {
      out = out.replace(/<html([^>]*)>/i, `<html$1><head><style>${css}</style></head>`);
    } else if (!/<style>/i.test(out)) {
      out = `<style>${css}</style>${out}`;
    }
  }

  return injectLogoLayers(out, back, front);
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/** Converte texto simples legado em HTML para o editor visual. */
export function plainTextToEditorHtml(text: string): string {
  if (!text.trim()) return "<p></p>";
  if (/<[a-z][\s\S]*>/i.test(text)) return text;
  return text
    .split("\n")
    .map((line) => `<p>${escapeHtml(line) || "<br>"}</p>`)
    .join("");
}

/** Extrai texto simples a partir de HTML (modo texto legado). */
export function editorHtmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Remove scripts/handlers antes de guardar HTML do editor. */
export function sanitizeDocumentEditorHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*(["'])[\s\S]*?\1/gi, "")
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, "")
    .slice(0, 200_000);
}

/** Sanitiza HTML importado de DOCX. */
export function sanitizeImportedDocxHtml(html: string): string {
  return sanitizeDocumentEditorHtml(html)
    .replace(/<img\b[^>]*>/gi, "")
    .replace(/<a\b([^>]*?)href=["'][^"']*["']([^>]*)>/gi, "<span$1$2>");
}
