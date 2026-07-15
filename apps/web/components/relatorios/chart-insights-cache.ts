import type { RelatorioDescricaoGrafico, RelatorioInsightsRequest } from "@nexiforma/shared";

const STORAGE_PREFIX = "nexiforma-chart-insights";

const memory: Partial<
  Record<RelatorioInsightsRequest["secao"], RelatorioDescricaoGrafico[] | null>
> = {};

export function readChartInsightsCache(
  secao: RelatorioInsightsRequest["secao"],
): RelatorioDescricaoGrafico[] | null {
  if (memory[secao] !== undefined) {
    return memory[secao] ?? null;
  }
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(`${STORAGE_PREFIX}:${secao}`);
    if (!raw) {
      memory[secao] = null;
      return null;
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      memory[secao] = null;
      return null;
    }
    memory[secao] = parsed as RelatorioDescricaoGrafico[];
    return memory[secao];
  } catch {
    memory[secao] = null;
    return null;
  }
}

export function persistChartInsightsCache(
  secao: RelatorioInsightsRequest["secao"],
  descricoes: RelatorioDescricaoGrafico[] | undefined,
) {
  const value = descricoes ?? [];
  memory[secao] = value;
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(`${STORAGE_PREFIX}:${secao}`, JSON.stringify(value));
  } catch {
    /* quota / private mode */
  }
}
