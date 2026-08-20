/** Delimitador serializado entre páginas no HTML guardado (invisível no editor visual). */
export const DOCUMENT_PAGE_BREAK = "<!--NEXIFORMA_PAGE_BREAK-->";

const EMPTY_PAGE_HTML = "<p><br></p>";

export function isEmptyDocumentPage(html: string): boolean {
  const text = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<br\s*\/?>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .trim();
  return !text;
}

/** Divide HTML guardado em páginas (retrocompatível com documentos de página única). */
export function parseDocumentPages(html: string): string[] {
  if (!html?.trim()) return [EMPTY_PAGE_HTML];
  const parts = html.split(DOCUMENT_PAGE_BREAK);
  const pages = parts.map((part) => {
    const trimmed = part.trim();
    return trimmed || EMPTY_PAGE_HTML;
  });
  return pages.length > 0 ? pages : [EMPTY_PAGE_HTML];
}

/** Junta páginas num único HTML para persistência. */
export function serializeDocumentPages(pages: string[]): string {
  const normalized = pages.map((page) => {
    const trimmed = page.trim();
    return trimmed || EMPTY_PAGE_HTML;
  });

  while (normalized.length > 1 && isEmptyDocumentPage(normalized[normalized.length - 1]!)) {
    normalized.pop();
  }

  if (normalized.length === 0) return EMPTY_PAGE_HTML;
  return normalized.join(DOCUMENT_PAGE_BREAK);
}

/** Gera blocos `.doc-page-shell` para pré-visualização / PDF. */
export function buildDocumentPageShellsHtml(
  bodyHtml: string,
  verticalAlign: "top" | "middle" | "bottom" = "top",
): string {
  const pages = parseDocumentPages(bodyHtml);
  return pages
    .map(
      (page) => `<div class="doc-page-shell">
    <div class="doc-page-body" data-v-align="${verticalAlign}">
      <div class="doc-content-layer">${page.trim() || "<p></p>"}</div>
    </div>
  </div>`,
    )
    .join("\n");
}
