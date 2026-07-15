"use client";

import { Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/ui/cn";

type Props = {
  titulo: string;
  descricao: string | null;
  loading?: boolean;
  enterprise?: boolean;
  className?: string;
};

export function ChartInsightBlurb({
  titulo,
  descricao,
  loading = false,
  enterprise = false,
  className,
}: Props) {
  if (!enterprise) return null;

  return (
    <div
      className={cn(
        "mt-3 rounded-lg border border-violet-500/20 bg-violet-950/20 px-3 py-2.5",
        className,
      )}
    >
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-violet-300/90">
        <Sparkles className="h-3 w-3" />
        Análise IA · {titulo}
      </p>
      {loading ? (
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500">
          <Loader2 className="h-3 w-3 animate-spin" /> A interpretar dados…
        </p>
      ) : descricao ? (
        <div className="mt-1.5 space-y-2 text-xs leading-relaxed text-slate-400">
          {descricao.split(/\n\s*\n/).map((p, i) => (
            <p key={i} className="whitespace-pre-wrap">
              {p.trim()}
            </p>
          ))}
        </div>
      ) : (
        <p className="mt-1.5 text-xs text-slate-600">
          Gere a análise completa em Relatórios para ver a interpretação deste gráfico.
        </p>
      )}
    </div>
  );
}
