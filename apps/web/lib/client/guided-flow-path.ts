import type { GuidedFlowStep } from "@/components/fluxo/guided-flow-types";

export type GuidedFlowHrefOptions = {
  prefix?: boolean;
  requireChild?: boolean;
};

function pathMatches(
  pathname: string,
  path: string,
  options?: GuidedFlowHrefOptions,
): boolean {
  const childSegment = pathname.startsWith(`${path}/`)
    ? pathname.slice(path.length + 1)
    : "";
  const hasSingleChild = Boolean(childSegment) && !childSegment.includes("/");

  if (options?.requireChild) {
    return hasSingleChild;
  }
  if (options?.prefix) {
    return pathname === path || hasSingleChild;
  }
  return pathname === path;
}

function searchMatches(search: string, queryString: string | undefined): boolean {
  if (!queryString) return true;

  const normalizedSearch = search.startsWith("?") ? search : search ? `?${search}` : "";
  const expected = new URLSearchParams(queryString);
  const actual = new URLSearchParams(normalizedSearch.replace(/^\?/, ""));

  for (const [key, value] of expected.entries()) {
    if (actual.get(key) !== value) return false;
  }
  return true;
}

export function guidedFlowStepHrefOptions(
  step: GuidedFlowStep | null | undefined,
): GuidedFlowHrefOptions {
  if (!step) return {};
  const requireChild =
    step.autoAdvanceRequiresChildPath ??
    (step.autoAdvance ? step.hrefPrefix : false);
  return {
    prefix: step.hrefPrefix,
    requireChild: requireChild || undefined,
  };
}

/** Verifica se a rota actual corresponde ao href de um passo do fluxo guiado. */
export function matchesGuidedFlowHref(
  pathname: string,
  search: string,
  href?: string,
  options?: GuidedFlowHrefOptions,
): boolean {
  if (!href) return true;

  const [path, queryString] = href.split("?");
  if (!pathMatches(pathname, path, options)) return false;
  return searchMatches(search, queryString);
}

/** Destino de navegação preservando rota filha (ex.: ficha da acção + ?tab=cronograma). */
export function resolveGuidedFlowNavigationHref(
  pathname: string,
  stepHref: string,
): string {
  const [path, queryString] = stepHref.split("?");
  if (queryString && (pathname === path || pathname.startsWith(`${path}/`))) {
    return `${pathname}?${queryString}`;
  }
  return stepHref;
}

/** Passo cumprido (para auto-avanço e indicador verde). */
export function isGuidedFlowStepComplete(
  pathname: string,
  search: string,
  step: GuidedFlowStep | null | undefined,
): boolean {
  if (!step?.href) return false;
  return matchesGuidedFlowHref(pathname, search, step.href, guidedFlowStepHrefOptions(step));
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
