import type { RelatorioKpi } from "@nexiforma/shared";
import { cn } from "@/lib/ui/cn";
import { deltaColor, fmtDelta, fmtKpiValor } from "./format";

type Props = {
  kpi: RelatorioKpi;
  icon?: React.ReactNode;
  accent?: string;
};

const COMP_LABELS = [
  { key: "mesAnterior" as const, short: "Mês ant." },
  { key: "trimestreAnterior" as const, short: "Trim. ant." },
  { key: "semestreAnterior" as const, short: "Sem. ant." },
  { key: "anoAnterior" as const, short: "Ano ant." },
];

export function ReportKpiCard({ kpi, icon, accent = "text-blue-400" }: Props) {
  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{kpi.label}</p>
        {icon ? <span className={cn("shrink-0 opacity-80", accent)}>{icon}</span> : null}
      </div>
      <p className={cn("mt-2 text-2xl font-bold tabular-nums text-slate-50", accent)}>
        {fmtKpiValor(kpi)}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-1.5">
        {COMP_LABELS.map(({ key, short }) => {
          const v = kpi.comparacoes[key];
          return (
            <div
              key={key}
              className="rounded-md bg-slate-950/50 px-2 py-1"
              title={`Referência: ${v.referencia}`}
            >
              <span className="block text-[9px] uppercase text-slate-600">{short}</span>
              <span className={cn("text-xs font-semibold tabular-nums", deltaColor(v.deltaPct))}>
                {fmtDelta(v.deltaPct)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
