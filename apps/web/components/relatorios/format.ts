import type { RelatorioKpi } from "@nexiforma/shared";
import { fmtEuro } from "@/lib/crm/shared";

export function fmtKpiValor(kpi: RelatorioKpi): string {
  switch (kpi.formato) {
    case "euro":
      return fmtEuro(kpi.valor);
    case "percentagem":
      return `${kpi.valor}%`;
    default:
      return new Intl.NumberFormat("pt-PT").format(kpi.valor);
  }
}

export function fmtDelta(pct: number | null): string {
  if (pct == null) return "-";
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct}%`;
}

export function deltaColor(pct: number | null): string {
  if (pct == null) return "text-slate-500";
  if (pct > 0) return "text-emerald-400";
  if (pct < 0) return "text-red-400";
  return "text-slate-400";
}

export function centavosToEuro(c: number): number {
  return Math.round(c) / 100;
}
