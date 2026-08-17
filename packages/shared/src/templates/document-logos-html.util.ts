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
  const z = p.zona === "marca_agua" ? 0 : 2;
  return `position:absolute;left:${x}%;top:${y}%;width:${w}px;height:${h}px;object-fit:contain;opacity:${opacity};z-index:${z};`;
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
    .doc-page-canvas { position: relative; min-height: 277mm; }
    .doc-content-layer { position: relative; z-index: 1; }
    .doc-logo-abs { pointer-events: none; }
  `.trim();
}

/**
 * Injeta logos resolvidos (data-URI) no HTML do documento com posicionamento absoluto (xPct/yPct).
 */
export function applyDocumentLogosToHtml(html: string, logos: ResolvedDocumentLogo[]): string {
  if (!html.trim() || !logos.length) return html;

  const normalized = logos.map((l, i) => ({
    ...l,
    ...normalizeLogoPlacement(l, i),
  }));

  const absoluteImgs = normalized.map(absoluteLogoHtml).filter(Boolean).join("");
  const css = documentLogosCss();

  let out = html;
  if (css && !/doc-page-canvas/.test(out)) {
    if (/<head[^>]*>/i.test(out)) {
      out = out.replace(/<head([^>]*)>/i, `<head$1><style>${css}</style>`);
    } else if (/<html[^>]*>/i.test(out)) {
      out = out.replace(/<html([^>]*)>/i, `<html$1><head><style>${css}</style></head>`);
    }
  }

  const canvasOpen = `<div class="doc-page-canvas">${absoluteImgs}`;
  const canvasClose = `</div>`;

  if (/<body[^>]*>/i.test(out)) {
    if (/doc-page-canvas/.test(out)) {
      out = out.replace(
        /<div class="doc-page-canvas">/i,
        `<div class="doc-page-canvas">${absoluteImgs}`,
      );
    } else if (/doc-content-layer/.test(out)) {
      out = out.replace(
        /(<body[^>]*>)(\s*<div class="doc-content-layer">)/i,
        `$1${canvasOpen}$2`,
      );
      out = out.replace(/<\/body>/i, `${canvasClose}</body>`);
    } else {
      out = out.replace(/<body([^>]*)>/i, `<body$1>${canvasOpen}<div class="doc-content-layer">`);
      out = out.replace(/<\/body>/i, `</div>${canvasClose}</body>`);
    }
  } else {
    out = `${canvasOpen}<div class="doc-content-layer">${out}</div>${canvasClose}`;
  }

  return out;
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
