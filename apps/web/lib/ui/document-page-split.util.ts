import {
  DOCUMENT_MARGIN_MM,
  mmToCssPx,
  pageDimensionsMm,
  type DocumentOrientacao,
} from "@nexiforma/shared";

const EMPTY_PAGE_HTML = "<p><br></p>";

export function pageContentMaxHeightPx(orientacao: DocumentOrientacao = "portrait"): number {
  const { height } = pageDimensionsMm(orientacao);
  return mmToCssPx(height - DOCUMENT_MARGIN_MM * 2);
}

/** Divide conteúdo HTML quando excede a altura útil de uma página A4. */
export function splitOverflowPageContent(
  html: string,
  opts: {
    orientacao: DocumentOrientacao;
    editorCss: string;
  },
): { fit: string; overflow: string } {
  if (typeof document === "undefined") {
    return { fit: html, overflow: "" };
  }

  const { orientacao, editorCss } = opts;
  const pageMm = pageDimensionsMm(orientacao);
  const maxHeight = pageContentMaxHeightPx(orientacao);

  const mount = document.createElement("div");
  mount.className = "doc-editor-measure-root";
  mount.style.cssText =
    "position:fixed;left:-99999px;top:0;visibility:hidden;pointer-events:none;z-index:-1;";

  const styleEl = document.createElement("style");
  styleEl.textContent = `${editorCss.replace(/\.doc-editor-root/g, ".doc-editor-measure-root")}
    .doc-editor-measure-root .doc-content-layer {
      overflow: visible !important;
      max-height: none !important;
    }`;

  const shell = document.createElement("div");
  shell.className = "doc-page-shell";
  shell.style.width = `${pageMm.width}mm`;
  shell.style.height = `${pageMm.height}mm`;
  shell.style.boxSizing = "border-box";

  const body = document.createElement("div");
  body.className = "doc-page-body";
  body.setAttribute("data-v-align", "top");

  const layer = document.createElement("div");
  layer.className = "doc-content-layer rich-template-editor";
  layer.innerHTML = html?.trim() ? html : EMPTY_PAGE_HTML;

  body.appendChild(layer);
  shell.appendChild(body);
  mount.appendChild(styleEl);
  mount.appendChild(shell);
  document.body.appendChild(mount);

  try {
    if (layer.scrollHeight <= maxHeight + 2) {
      return { fit: html, overflow: "" };
    }

    const originalNodes = Array.from(layer.childNodes);
    if (originalNodes.length === 0) {
      return { fit: html, overflow: "" };
    }

    const fitFrag = document.createDocumentFragment();
    const overflowFrag = document.createDocumentFragment();
    let overflowStarted = false;

    for (const node of originalNodes) {
      if (overflowStarted) {
        overflowFrag.appendChild(node.cloneNode(true));
        continue;
      }

      fitFrag.appendChild(node.cloneNode(true));
      layer.innerHTML = "";
      layer.appendChild(fitFrag.cloneNode(true));

      if (layer.scrollHeight > maxHeight + 2) {
        fitFrag.removeChild(fitFrag.lastChild!);
        overflowStarted = true;
        overflowFrag.appendChild(node.cloneNode(true));
      }
    }

    if (!overflowFrag.hasChildNodes()) {
      return { fit: html, overflow: "" };
    }

    if (!fitFrag.hasChildNodes()) {
      return { fit: html, overflow: "" };
    }

    const fitWrap = document.createElement("div");
    fitWrap.appendChild(fitFrag);
    const overflowWrap = document.createElement("div");
    overflowWrap.appendChild(overflowFrag);

    return {
      fit: fitWrap.innerHTML.trim() || EMPTY_PAGE_HTML,
      overflow: overflowWrap.innerHTML.trim(),
    };
  } finally {
    document.body.removeChild(mount);
  }
}

/** Propaga overflow entre páginas consecutivas (ex.: colar texto longo). */
export function rebalanceDocumentPages(
  pages: string[],
  startIndex: number,
  opts: {
    orientacao: DocumentOrientacao;
    editorCss: string;
  },
): string[] {
  const result = [...pages];
  let index = Math.max(0, startIndex);

  while (index < result.length) {
    const current = result[index]?.trim() ? result[index]! : EMPTY_PAGE_HTML;
    const { fit, overflow } = splitOverflowPageContent(current, opts);
    result[index] = fit;

    if (!overflow.trim()) break;

    if (index + 1 < result.length) {
      result[index + 1] = `${overflow}${result[index + 1]}`;
    } else {
      result.push(overflow);
    }
    index += 1;
  }

  return result;
}

export function selectionIsAtEditorEnd(editorEl: HTMLDivElement | null): boolean {
  if (!editorEl) return false;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return false;
  const range = sel.getRangeAt(0);
  if (!range.collapsed || !editorEl.contains(range.endContainer)) return false;

  const tail = document.createRange();
  tail.selectNodeContents(editorEl);
  tail.setStart(range.endContainer, range.endOffset);
  return tail.toString().length === 0;
}
