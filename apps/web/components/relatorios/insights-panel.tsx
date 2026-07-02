"use client";

import { useState } from "react";
import { FileDown, Loader2, Sparkles } from "lucide-react";
import type { RelatorioInsightsRequest, RelatorioInsightsResponse } from "@nexiforma/shared";
import { bffFetch } from "@/lib/client/bff-fetch";
import { downloadResponseAsFile } from "@/lib/client/download-response";
import { parseApiError } from "@/lib/ui/backoffice";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { cn } from "@/lib/ui/cn";

type Props = {
  secao: RelatorioInsightsRequest["secao"];
  className?: string;
};

export function ReportInsightsPanel({ secao, className }: Props) {
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<RelatorioInsightsResponse | null>(null);

  async function gerar() {
    setLoading(true);
    setError(null);
    try {
      const res = await bffFetch("/api/v1/relatorios/insights", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ secao } satisfies RelatorioInsightsRequest),
      });
      if (!res.ok) {
        setError(await parseApiError(res));
        return;
      }
      setData((await res.json()) as RelatorioInsightsResponse);
    } catch {
      setError("Não foi possível gerar a análise.");
    } finally {
      setLoading(false);
    }
  }

  async function exportarPdf() {
    setPdfLoading(true);
    setError(null);
    try {
      const res = await bffFetch("/api/v1/relatorios/insights/pdf", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/pdf" },
        body: JSON.stringify({ secao } satisfies RelatorioInsightsRequest),
      });
      if (!res.ok) {
        setError(await parseApiError(res));
        return;
      }
      await downloadResponseAsFile(res, `relatorio-${secao}.pdf`);
    } catch {
      setError("Não foi possível gerar o PDF.");
    } finally {
      setPdfLoading(false);
    }
  }

  return (
    <Card className={cn("border-violet-500/20", className)}>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-400" />
            Análise inteligente
          </CardTitle>
          <p className="text-xs text-slate-500 mt-1">
            Interpretação automática dos dados. Exporte PDF com KPIs, gráficos e recomendações.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => void exportarPdf()}
            disabled={pdfLoading || loading}
            className="flex items-center gap-1.5 rounded-lg border border-slate-600/60 bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 disabled:opacity-50"
          >
            {pdfLoading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> PDF…
              </>
            ) : (
              <>
                <FileDown className="h-3.5 w-3.5" /> Exportar PDF
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => void gerar()}
            disabled={loading || pdfLoading}
            className="rounded-lg bg-violet-600/90 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> A gerar…
              </span>
            ) : (
              "Gerar análise IA"
            )}
          </button>
        </div>
      </CardHeader>
      {error ? (
        <CardContent>
          <p className="text-sm text-red-400">{error}</p>
        </CardContent>
      ) : null}
      {data ? (
        <CardContent className="space-y-4 border-t border-slate-800/60 pt-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-100">{data.titulo}</span>
            <Badge variant={data.engine === "llm" ? "purple" : "default"}>
              {data.engine === "llm" ? "IA" : "Automático"}
            </Badge>
          </div>
          <p className="text-sm leading-relaxed text-slate-300">{data.resumo}</p>
          {data.pontos.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Destaques
              </p>
              <ul className="space-y-1.5">
                {data.pontos.map((p, i) => (
                  <li key={i} className="flex gap-2 text-sm text-slate-300">
                    <span className="text-violet-400">•</span>
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {data.recomendacoes.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Recomendações
              </p>
              <ul className="space-y-1.5">
                {data.recomendacoes.map((r, i) => (
                  <li key={i} className="flex gap-2 text-sm text-slate-400">
                    <span className="text-emerald-400">→</span>
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardContent>
      ) : null}
    </Card>
  );
}
