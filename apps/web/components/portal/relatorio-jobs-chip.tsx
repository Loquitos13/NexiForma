"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, FileDown, Loader2, RefreshCw, X } from "lucide-react";
import { useRelatorioJobs, type RelatorioJob } from "@/lib/relatorios/relatorio-jobs-context";
import { cn } from "@/lib/ui/cn";

export function RelatorioJobsChip() {
  const { jobs, descarregarRelatorio, descartarRelatorio, gerarRelatorio } =
    useRelatorioJobs();
  const [openErrorId, setOpenErrorId] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openErrorId) return;
    function onDocClick(e: MouseEvent) {
      const t = e.target as Node;
      if (rootRef.current?.contains(t)) return;
      setOpenErrorId(null);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [openErrorId]);

  if (jobs.length === 0) return null;

  return (
    <div ref={rootRef} className="relative z-[60] flex flex-wrap items-center gap-1.5">
      {jobs.map((job) => {
        if (job.status === "A_GERAR") {
          return (
            <span
              key={job.id}
              className="inline-flex items-center gap-1.5 rounded-full border border-violet-400/40 bg-violet-500/10 px-2.5 py-1 text-[11px] font-medium text-violet-200 shadow-sm"
              title={`A gerar relatório ${job.secaoLabel} em background…`}
            >
              <Loader2 className="h-3 w-3 animate-spin text-violet-400" />
              <span className="max-w-[10rem] truncate">
                Relatório {job.secaoLabel}: a gerar…
              </span>
            </span>
          );
        }

        if (job.status === "PRONTO") {
          return (
            <span
              key={job.id}
              className="inline-flex items-center gap-0.5 rounded-full border border-emerald-400/40 bg-emerald-500/10 text-[11px] font-medium text-emerald-200 shadow-sm"
            >
              <button
                type="button"
                onClick={() => descarregarRelatorio(job.id)}
                className="inline-flex items-center gap-1.5 rounded-l-full px-2.5 py-1 transition-colors hover:bg-emerald-500/20"
                title="Relatório concluído! Clique para descarregar o PDF"
              >
                <FileDown className="h-3 w-3 text-emerald-400" />
                <span className="max-w-[10rem] truncate font-semibold">
                  Relatório {job.secaoLabel}: descarregar
                </span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  descartarRelatorio(job.id);
                }}
                className="rounded-r-full px-1.5 py-1 text-emerald-300/80 transition-colors hover:bg-emerald-500/25 hover:text-emerald-100"
                title="Fechar notificação"
                aria-label="Fechar notificação de relatório"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          );
        }

        if (job.status === "FALHA") {
          const open = openErrorId === job.id;
          return (
            <div key={job.id} className="relative">
              <span className="inline-flex items-center gap-0.5 rounded-full border border-amber-400/40 bg-amber-500/10 text-[11px] font-medium text-amber-200 shadow-sm">
                <button
                  type="button"
                  onClick={() => setOpenErrorId(open ? null : job.id)}
                  className="inline-flex items-center gap-1.5 rounded-l-full px-2.5 py-1 transition-colors hover:bg-amber-500/20"
                  title="Falha ao gerar relatório - clique para ver detalhes"
                >
                  <AlertTriangle className="h-3 w-3 text-amber-400" />
                  <span className="max-w-[10rem] truncate">
                    Relatório {job.secaoLabel}: falhou
                  </span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    descartarRelatorio(job.id);
                  }}
                  className="rounded-r-full px-1.5 py-1 text-amber-300/80 transition-colors hover:bg-amber-500/25 hover:text-amber-100"
                  title="Descartar"
                  aria-label="Descartar erro de relatório"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>

              {open ? (
                <div className="absolute right-0 top-full mt-2 w-64 rounded-lg border border-amber-500/40 bg-slate-950 p-3 text-xs text-slate-300 shadow-2xl shadow-black/60 ring-1 ring-amber-500/20">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-amber-200">Falha no relatório</p>
                    <button
                      type="button"
                      onClick={() => setOpenErrorId(null)}
                      className="text-slate-500 hover:text-slate-300"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="mt-1.5 leading-relaxed text-slate-400">
                    {job.erro ?? "Ocorreu um erro ao processar o PDF na VPS."}
                  </p>
                  <div className="mt-2.5 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setOpenErrorId(null);
                        void gerarRelatorio(job.secao);
                      }}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-600 px-2 py-1 text-[11px] font-medium text-slate-300 hover:bg-slate-800"
                    >
                      <RefreshCw className="h-3 w-3" /> Tentar novamente
                    </button>
                    <button
                      type="button"
                      onClick={() => descartarRelatorio(job.id)}
                      className="rounded-md border border-slate-600 px-2 py-1 text-[11px] font-medium text-slate-300 hover:bg-slate-800"
                    >
                      Descartar
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}
