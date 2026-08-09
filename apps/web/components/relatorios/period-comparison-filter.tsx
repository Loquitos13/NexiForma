"use client";

import { PERIODO_OPCOES, type PeriodoComparacao } from "@/lib/relatorios/period-filter";
import { cn } from "@/lib/ui/cn";

type Props = {
  value: PeriodoComparacao;
  onChange: (v: PeriodoComparacao) => void;
  className?: string;
};

export function PeriodComparisonFilter({ value, onChange, className }: Props) {
  return (
    <div className={cn("portal-tab-strip flex flex-wrap gap-1", className)}>
      {PERIODO_OPCOES.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onChange(p.id)}
          className={cn(
            "rounded-md px-3 py-2 text-xs font-medium transition-colors sm:px-2.5 sm:py-1 sm:text-[11px]",
            value === p.id
              ? "bg-violet-600/30 text-violet-200 ring-1 ring-violet-500/40"
              : "text-slate-500 hover:bg-slate-800/60 hover:text-slate-300",
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
