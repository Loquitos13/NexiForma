export type DocumentOrientacao = "portrait" | "landscape";
export type DocumentVerticalAlign = "top" | "middle" | "bottom";

export const A4_WIDTH_MM = 210;
export const A4_HEIGHT_MM = 297;
export const DOCUMENT_MARGIN_MM = 8;

export function a4AspectRatio(orientacao: DocumentOrientacao = "portrait"): string {
  return orientacao === "landscape" ? "297 / 210" : "210 / 297";
}

export function pageDimensionsMm(orientacao: DocumentOrientacao = "portrait"): {
  width: number;
  height: number;
} {
  return orientacao === "landscape"
    ? { width: A4_HEIGHT_MM, height: A4_WIDTH_MM }
    : { width: A4_WIDTH_MM, height: A4_HEIGHT_MM };
}

/** CSS partilhado entre editor, pré-visualização e PDF. */
export function documentPageCss(
  orientacao: DocumentOrientacao = "portrait",
  extraCss = "",
): string {
  const { width, height } = pageDimensionsMm(orientacao);
  const pageSize = orientacao === "landscape" ? "A4 landscape" : "A4 portrait";
  const innerH = height - DOCUMENT_MARGIN_MM * 2;

  return `
    @page { size: ${pageSize}; margin: ${DOCUMENT_MARGIN_MM}mm; }
    html, body { margin: 0; padding: 0; background: #fff; }
    body {
      font-family: Georgia, "Times New Roman", serif;
      color: #111;
      line-height: 1.45;
      font-size: 13px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .doc-page-shell {
      box-sizing: border-box;
      width: ${width}mm;
      min-height: ${height}mm;
      margin: 0 auto;
      padding: ${DOCUMENT_MARGIN_MM}mm;
      background: #fff;
    }
    .doc-page-body {
      box-sizing: border-box;
      min-height: ${innerH}mm;
      display: flex;
      flex-direction: column;
    }
    .doc-page-body[data-v-align="top"] { justify-content: flex-start; }
    .doc-page-body[data-v-align="middle"] { justify-content: center; }
    .doc-page-body[data-v-align="bottom"] { justify-content: flex-end; }
    .doc-content-layer { width: 100%; }
    .doc-content-layer h1 { font-size: 1.6em; font-weight: 700; margin: 0.6em 0 0.3em; }
    .doc-content-layer h2 { font-size: 1.35em; font-weight: 700; margin: 0.5em 0 0.25em; }
    .doc-content-layer h3 { font-size: 1.15em; font-weight: 600; margin: 0.45em 0 0.2em; }
    .doc-content-layer p { margin: 0 0 10px; }
    .doc-content-layer ul, .doc-content-layer ol { margin: 0 0 10px 1.25em; }
    .doc-content-layer table { width: 100%; border-collapse: collapse; margin: 12px 0; }
    ${extraCss}
  `.trim();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** HTML completo para iframe de pré-visualização (client-side). */
export function buildDocumentPreviewHtml(
  bodyHtml: string,
  opts?: {
    title?: string;
    orientacao?: DocumentOrientacao;
    verticalAlign?: DocumentVerticalAlign;
    extraCss?: string;
  },
): string {
  const orientacao = opts?.orientacao ?? "portrait";
  const verticalAlign = opts?.verticalAlign ?? "top";
  const title = escapeHtml(opts?.title ?? "Pré-visualização");
  const css = documentPageCss(orientacao, opts?.extraCss ?? "");

  return `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>${css}</style>
</head>
<body>
  <div class="doc-page-shell">
    <div class="doc-page-body" data-v-align="${verticalAlign}">
      <div class="doc-content-layer">${bodyHtml?.trim() || "<p></p>"}</div>
    </div>
  </div>
</body>
</html>`;
}
