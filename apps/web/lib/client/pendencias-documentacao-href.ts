/** Deep-link para sessão com documentação pedagógica por preencher. */

export type PendenciaFocus = "folha" | "sumario" | "pendencias";

export function buildPendenciaSessaoHref(input: {
  acaoId: string;
  sessaoId: string;
  focus?: PendenciaFocus;
}): string {
  const q = new URLSearchParams();
  q.set("tab", "cronograma");
  q.set("sessaoId", input.sessaoId);
  if (input.focus) q.set("focus", input.focus);
  return `/portal/acoes/${encodeURIComponent(input.acaoId)}?${q.toString()}`;
}

export function resolvePendenciaItemFocus(itemLabel: string): PendenciaFocus {
  const t = itemLabel.toLowerCase();
  if (t.includes("folha") || t.includes("presen")) return "folha";
  if (t.includes("sumário") || t.includes("sumario")) return "sumario";
  return "pendencias";
}

export function readPendenciaFocusFromSearch(
  search: string,
): PendenciaFocus | null {
  const raw = new URLSearchParams(search).get("focus");
  if (raw === "folha" || raw === "sumario" || raw === "pendencias") return raw;
  return null;
}
