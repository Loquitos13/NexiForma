"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import type { RelatorioDashboard } from "@nexiforma/shared";
import { bffFetch } from "@/lib/client/bff-fetch";
import { parseApiError } from "@/lib/ui/backoffice";
import { Alert, PageContentSkeleton, PageHeader } from "@/components/ui";
import { cn } from "@/lib/ui/cn";
import {
  RELATORIO_TABS,
  RelatoriosTabContent,
  type RelatorioTab,
} from "@/components/relatorios/sections";

export default function RelatoriosPage() {
  const [data, setData] = useState<RelatorioDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<RelatorioTab>("financeiro");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await bffFetch("/api/v1/relatorios/dashboard", {
        headers: { accept: "application/json" },
      });
      if (!res.ok) {
        setError(await parseApiError(res));
        return;
      }
      setData((await res.json()) as RelatorioDashboard);
    } catch {
      setError("Erro ao carregar relatórios.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !data) {
    return <PageContentSkeleton />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Relatórios"
        description="Análise financeira, comercial e empresarial com comparações temporais e insights IA."
        actions={
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700/60 bg-slate-900/80 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-50"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            Actualizar
          </button>
        }
      />

      {error ? <Alert variant="error">{error}</Alert> : null}

      {data ? (
        <>
          <p className="text-xs text-slate-500">
            Período de referência:{" "}
            {new Date(data.periodoReferencia.inicio).toLocaleDateString("pt-PT")} -{" "}
            {new Date(data.periodoReferencia.fim).toLocaleDateString("pt-PT")} · Gerado{" "}
            {new Date(data.geradoEm).toLocaleString("pt-PT")}
          </p>

          <div className="flex flex-wrap gap-1 rounded-xl border border-slate-800/80 bg-slate-950/50 p-1">
            {RELATORIO_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                  tab === t.id
                    ? "bg-blue-600/25 text-blue-300 shadow-sm"
                    : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200",
                )}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>

          <p className="text-xs text-slate-600">
            Cada KPI inclui variação vs mês anterior, trimestre anterior, semestre anterior e ano
            anterior.
          </p>

          <RelatoriosTabContent data={data} tab={tab} />
        </>
      ) : null}
    </div>
  );
}
