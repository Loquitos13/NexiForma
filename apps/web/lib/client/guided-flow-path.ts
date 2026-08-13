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
