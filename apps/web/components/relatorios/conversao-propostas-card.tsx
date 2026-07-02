import type { RelatorioConversaoPropostas } from "@nexiforma/shared";
import { ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { fmtEuro } from "@/lib/crm/shared";

type Props = {
  conversao: RelatorioConversaoPropostas;
};

function Step({
  label,
  value,
  pct,
  accent,
}: {
  label: string;
  value: number;
  pct?: string;
  accent: string;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col rounded-lg border border-slate-700/50 bg-slate-950/40 px-4 py-3">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <span className={`mt-1 text-2xl font-bold tabular-nums ${accent}`}>{value}</span>
      {pct ? <span className="mt-0.5 text-xs text-slate-400">{pct}</span> : null}
    </div>
  );
}

export function ConversaoPropostasCard({ conversao }: Props) {
  const c = conversao;
  return (
    <Card className="border-blue-500/20">
      <CardHeader>
        <CardTitle>Conversão comercial (mês actual)</CardTitle>
        <p className="text-xs text-slate-500">
          Coorte de propostas <strong className="text-slate-400">enviadas neste mês</strong> → aceites →
          faturação associada. Percentagens calculadas sobre a mesma coorte.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          <Step label="Enviadas" value={c.enviadas} accent="text-slate-100" />
          <ArrowRight className="hidden h-4 w-4 shrink-0 text-slate-600 sm:block" />
          <Step
            label="Aceites"
            value={c.aceites}
            pct={`${c.taxaAceitePct}% das enviadas`}
            accent="text-blue-400"
          />
          <ArrowRight className="hidden h-4 w-4 shrink-0 text-slate-600 sm:block" />
          <Step
            label="Faturadas"
            value={c.faturadas}
            pct={`${c.taxaFaturacaoPct}% das aceites · ${c.taxaConversaoTotalPct}% total`}
            accent="text-emerald-400"
          />
        </div>
        {c.valorFaturadoCentavos > 0 ? (
          <p className="text-sm text-slate-400">
            Valor faturado (coorte enviada no mês):{" "}
            <span className="font-semibold tabular-nums text-emerald-400">
              {fmtEuro(c.valorFaturadoCentavos)}
            </span>
          </p>
        ) : null}
        {c.faturasEmitidasPeriodo > 0 &&
        (c.faturasEmitidasPeriodo !== c.faturadas ||
          c.valorFaturadoPeriodoCentavos !== c.valorFaturadoCentavos) ? (
          <p className="text-sm text-slate-500">
            Faturação emitida neste mês (todas as propostas):{" "}
            <span className="font-medium tabular-nums text-slate-300">
              {c.faturasEmitidasPeriodo} doc. · {fmtEuro(c.valorFaturadoPeriodoCentavos)}
            </span>
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
