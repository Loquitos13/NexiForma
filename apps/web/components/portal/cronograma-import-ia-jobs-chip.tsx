"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, Sparkles, X } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { cn } from "@/lib/ui/cn";

type ImportJobStatus = "A_PROCESSAR" | "RASCUNHO" | "FALHA" | "APLICADO" | "DESCARTADO";

type ImportJob = {
  id: string;
  cronogramaId: string;
  acaoFormacaoId: string;
  status: ImportJobStatus;
  nomeFicheiro: string | null;
  erro: string | null;
  progresso: number;
  createdAt: string;
  updatedAt: string;
  concludedAt: string | null;
  acaoFormacao?: { codigoInterno: string; titulo: string } | null;
};

type PanelPos = { top: number; right: number };

const POLL_MS = 5_000;

/** Mantém só o job mais recente por acção (evita chips duplicados). */
function dedupeJobs(jobs: ImportJob[]): ImportJob[] {
  const byAcao = new Map<string, ImportJob>();
  const sorted = [...jobs].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
  for (const job of sorted) {
    if (!byAcao.has(job.acaoFormacaoId)) byAcao.set(job.acaoFormacaoId, job);
  }
  return [...byAcao.values()];
}

export function CronogramaImportIaJobsChip() {
  const router = useRouter();
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [openErrorId, setOpenErrorId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [panelPos, setPanelPos] = useState<PanelPos | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const errorBtnRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  useEffect(() => setMounted(true), []);

  const [pollEnabled, setPollEnabled] = useState(true);

  const refresh = useCallback(async () => {
    if (!pollEnabled) return;
    try {
      const res = await bffFetch("/api/v1/cronogramas/importar-ia/jobs", {
        headers: { accept: "application/json" },
      });
      if (res.status === 401 || res.status === 403) {
        setPollEnabled(false);
        setJobs([]);
        return;
      }
      if (!res.ok) return;
      setJobs((await res.json()) as ImportJob[]);
    } catch {
      // Poll silencioso se BFF/API estiver indisponível.
    }
  }, [pollEnabled]);

  useEffect(() => {
    if (!pollEnabled) return;
    void refresh();
    const id = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(id);
  }, [refresh, pollEnabled]);

  const visibleJobs = useMemo(() => dedupeJobs(jobs), [jobs]);

  const updatePanelPos = useCallback((jobId: string) => {
    const btn = errorBtnRefs.current.get(jobId);
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const panelWidth = Math.min(288, window.innerWidth - 24);
    let right = window.innerWidth - rect.right;
    if (right + panelWidth > window.innerWidth - 12) {
      right = 12;
    }
    setPanelPos({
      top: rect.bottom + 8,
      right: Math.max(12, right),
    });
  }, []);

  useLayoutEffect(() => {
    if (!openErrorId) return;
    updatePanelPos(openErrorId);
    function onReposition() {
      if (openErrorId) updatePanelPos(openErrorId);
    }
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [openErrorId, updatePanelPos]);

  useEffect(() => {
    if (!openErrorId) return;
    function onDocClick(e: MouseEvent) {
      const t = e.target as Node;
      if (rootRef.current?.contains(t)) return;
      const panel = document.getElementById("cronograma-ia-error-panel");
      if (panel?.contains(t)) return;
      setOpenErrorId(null);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [openErrorId]);

  async function descartar(jobId: string) {
    setBusyId(jobId);
    try {
      await bffFetch(`/api/v1/cronogramas/importar-ia/jobs/${jobId}/descartar`, {
        method: "POST",
        headers: { accept: "application/json" },
      });
      setOpenErrorId(null);
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  const openJob = visibleJobs.find((j) => j.id === openErrorId && j.status === "FALHA");

  const errorPanel =
    mounted && openJob && panelPos
      ? createPortal(
          <div
            id="cronograma-ia-error-panel"
            role="dialog"
            aria-label="Falha ao analisar cronograma"
            style={{ top: panelPos.top, right: panelPos.right }}
            className="fixed z-[400] w-[min(18rem,calc(100vw-1.5rem))] rounded-lg border border-amber-500/40 bg-slate-950 p-3 text-xs text-slate-300 shadow-2xl shadow-black/60 ring-1 ring-amber-500/20"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium text-amber-200">Falha ao analisar</p>
              <button
                type="button"
                onClick={() => setOpenErrorId(null)}
                className="text-slate-500 hover:text-slate-300"
                aria-label="Fechar"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="mt-1.5 leading-relaxed text-slate-400">
              {openJob.erro ?? "Erro desconhecido."}
            </p>
            <div className="mt-2.5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() =>
                  router.push(
                    `/portal/acoes/${openJob.acaoFormacaoId}?tab=cronograma`,
                  )
                }
                className="rounded-md border border-slate-600 px-2 py-1 text-[11px] font-medium text-slate-300 hover:bg-slate-800"
              >
                Ver acção
              </button>
              <button
                type="button"
                disabled={busyId === openJob.id}
                onClick={() => void descartar(openJob.id)}
                className={cn(
                  "rounded-md border border-slate-600 px-2 py-1 text-[11px] font-medium text-slate-300 hover:bg-slate-800",
                  busyId === openJob.id && "opacity-50",
                )}
              >
                Descartar
              </button>
            </div>
          </div>,
          document.body,
        )
      : null;

  if (visibleJobs.length === 0) return null;

  return (
    <>
      <div ref={rootRef} className="relative z-[60] flex flex-wrap items-center gap-1.5">
        {visibleJobs.map((job) => {
          if (job.status === "A_PROCESSAR") {
            return (
              <span
                key={job.id}
                className="cronograma-ia-chip-processing inline-flex items-center gap-1.5 rounded-full border border-violet-400/40 bg-violet-500/10 px-2.5 py-1 text-[11px] font-medium text-violet-200"
                title={`A analisar cronograma${job.nomeFicheiro ? ` «${job.nomeFicheiro}»` : ""} com IA…`}
              >
                <Loader2 className="h-3 w-3 animate-spin" />
                <span className="max-w-[9rem] truncate">
                  {job.acaoFormacao?.codigoInterno ?? "Cronograma"}: a analisar…
                </span>
              </span>
            );
          }

          if (job.status === "RASCUNHO") {
            return (
              <span
                key={job.id}
                className="cronograma-ia-chip-ready inline-flex items-center gap-0.5 rounded-full border border-emerald-400/40 bg-emerald-500/10 text-[11px] font-medium text-emerald-200"
              >
                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      `/portal/acoes/${job.acaoFormacaoId}?tab=cronograma&importJob=${job.id}`,
                    )
                  }
                  className="inline-flex items-center gap-1.5 rounded-l-full px-2.5 py-1 transition-colors hover:bg-emerald-500/20"
                  title="Rascunho da IA pronto - clique para revisar e aplicar"
                >
                  <Sparkles className="h-3 w-3" />
                  <span className="max-w-[9rem] truncate">
                    {job.acaoFormacao?.codigoInterno ?? "Cronograma"}: rascunho pronto
                  </span>
                </button>
                <button
                  type="button"
                  disabled={busyId === job.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    void descartar(job.id);
                  }}
                  className="rounded-r-full px-1.5 py-1 text-emerald-300/80 transition-colors hover:bg-emerald-500/25 hover:text-emerald-100 disabled:opacity-50"
                  title="Descartar rascunho"
                  aria-label="Descartar rascunho"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          }

          if (job.status === "FALHA") {
            const open = openErrorId === job.id;
            return (
              <span
                key={job.id}
                className="inline-flex items-center gap-0.5 rounded-full border border-amber-400/40 bg-amber-500/10 text-[11px] font-medium text-amber-200"
              >
                <button
                  ref={(el) => {
                    if (el) errorBtnRefs.current.set(job.id, el);
                    else errorBtnRefs.current.delete(job.id);
                  }}
                  type="button"
                  onClick={() => {
                    if (open) {
                      setOpenErrorId(null);
                      return;
                    }
                    setOpenErrorId(job.id);
                    requestAnimationFrame(() => updatePanelPos(job.id));
                  }}
                  className="inline-flex items-center gap-1.5 rounded-l-full px-2.5 py-1 transition-colors hover:bg-amber-500/20"
                  title="A IA falhou a analisar este cronograma - clique para detalhes"
                >
                  <AlertTriangle className="h-3 w-3" />
                  <span className="max-w-[9rem] truncate">
                    {job.acaoFormacao?.codigoInterno ?? "Cronograma"}: falhou
                  </span>
                </button>
                <button
                  type="button"
                  disabled={busyId === job.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    void descartar(job.id);
                  }}
                  className="rounded-r-full px-1.5 py-1 text-amber-300/80 transition-colors hover:bg-amber-500/25 hover:text-amber-100 disabled:opacity-50"
                  title="Descartar"
                  aria-label="Descartar job falhado"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          }

          return null;
        })}
      </div>
      {errorPanel}
    </>
  );
}
