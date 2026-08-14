/** Verifica se a rota actual corresponde ao href de um passo do fluxo guiado. */
export function matchesGuidedFlowHref(
  pathname: string,
  search: string,
  href?: string,
): boolean {
  if (!href) return true;

  const normalizedSearch = search.startsWith("?")
    ? search
    : search
      ? `?${search}`
      : "";
  const [path, queryString] = href.split("?");

  if (pathname !== path) return false;
  if (!queryString) return true;

  const expected = new URLSearchParams(queryString);
  const actual = new URLSearchParams(normalizedSearch.replace(/^\?/, ""));

  for (const [key, value] of expected.entries()) {
    if (actual.get(key) !== value) return false;
  }
  return true;
}

export function buildGuidedFlowSearch(
  searchParams: { toString(): string } | null | undefined,
): string {
  const raw = searchParams?.toString() ?? "";
  return raw ? `?${raw}` : "";
}

function findOpenDialogLayer(): Element | null {
  return document.querySelector('[role="dialog"][data-state="open"]');
}

function isVisibleAnchor(el: Element): boolean {
  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
    return false;
  }
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

/** Resolve o elemento alvo do fluxo guiado, priorizando modais abertos sobre a página. */
export function resolveGuidedFlowAnchorElement(anchor: string): {
  element: Element | null;
  insideModal: boolean;
} {
  const candidates = Array.from(
    document.querySelectorAll(`[data-guided-flow-anchor="${anchor}"]`),
  );
  if (!candidates.length) return { element: null, insideModal: false };

  const openLayer = findOpenDialogLayer();
  if (openLayer) {
    const inLayer = candidates.find((el) => openLayer.contains(el));
    return { element: inLayer ?? null, insideModal: Boolean(inLayer) };
  }

  const outside = candidates.find(
    (el) => !el.closest('[role="dialog"]') && isVisibleAnchor(el),
  );
  return { element: outside ?? null, insideModal: false };
}
