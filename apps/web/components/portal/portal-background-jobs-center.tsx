"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronDown,
  FileDown,
  FileText,
  Loader2,
  RefreshCw,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import { useRelatorioJobs, type RelatorioJob } from "@/lib/relatorios/relatorio-jobs-context";
import { bffFetch } from "@/lib/client/bff-fetch";
import { cn } from "@/lib/ui/cn";

type CronogramaJobStatus = "A_PROCESSAR" | "RASCUNHO" | "FALHA" | "APLICADO" | "DESCARTADO";

type CronogramaJob = {
  id: string;
  cronogramaId: string;
  acaoFormacaoId: string;
  status: CronogramaJobStatus;
  nomeFicheiro: string | null;
  erro: string | null;
  progresso: number;
  createdAt: string;
  updatedAt: string;
  concludedAt: string | null;
  acaoFormacao?: { codigoInterno: string; titulo: string } | null;
};

const POLL_MS = 5_000;

function dedupeCronogramaJobs(jobs: CronogramaJob[]): CronogramaJob[] {
  const byAcao = new Map<string, CronogramaJob>();
  const sorted = [...jobs].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
  for (const job of sorted) {
    if (!byAcao.has(job.acaoFormacaoId)) byAcao.set(job.acaoFormacaoId, job);
  }
  return [...byAcao.values()].filter(
    (j) => j.status === "A_PROCESSAR" || j.status === "RASCUNHO" || j.status === "FALHA",
  );
}

type Props = {
  allowCronogramaJobs?: boolean;
};

export function PortalBackgroundJobsCenter({ allowCronogramaJobs = true }: Props) {
  const router = useRouter();
  const {
    jobs: relatorioJobs,
    descarregarRelatorio,
    descartarRelatorio,
    gerarRelatorio,
  } = useRelatorioJobs();

  const [cronogramaJobs, setCronogramaJobs] = useState<CronogramaJob[]>([]);
  const [pollEnabled, setPollEnabled] = useState(allowCronogramaJobs);
  const [isOpen, setIsOpen] = useState(false);
  const [busyCronogramaId, setBusyCronogramaId] = useState<string | null>(null);

  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const refreshCronogramas = useCallback(async () => {
    if (!pollEnabled || !allowCronogramaJobs) return;
    try {
      const res = await bffFetch("/api/v1/cronogramas/importar-ia/jobs", {
        headers: { accept: "application/json" },
      });
      if (res.status === 401 || res.status === 403) {
        setPollEnabled(false);
        setCronogramaJobs([]);
        return;
      }
      if (!res.ok) return;
      setCronogramaJobs((await res.json()) as CronogramaJob[]);
    } catch {
      // Silencioso
    }
  }, [pollEnabled, allowCronogramaJobs]);

  useEffect(() => {
    if (!pollEnabled || !allowCronogramaJobs) return;
    void refreshCronogramas();
    const id = setInterval(() => void refreshCronogramas(), POLL_MS);
    return () => clearInterval(id);
  }, [refreshCronogramas, pollEnabled, allowCronogramaJobs]);

  async function descartarCronograma(jobId: string) {
    setBusyCronogramaId(jobId);
    try {
      await bffFetch(`/api/v1/cronogramas/importar-ia/jobs/${jobId}/descartar`, {
        method: "POST",
        headers: { accept: "application/json" },
      });
      await refreshCronogramas();
    } finally {
      setBusyCronogramaId(null);
    }
  }

  const activeCronogramas = useMemo(
    () => dedupeCronogramaJobs(cronogramaJobs),
    [cronogramaJobs],
  );

  const totalJobsCount = relatorioJobs.length + activeCronogramas.length;

  const hasProcessing =
    relatorioJobs.some((j) => j.status === "A_GERAR") ||
    activeCronogramas.some((j) => j.status === "A_PROCESSAR");

  const hasFailures =
    relatorioJobs.some((j) => j.status === "FALHA") ||
    activeCronogramas.some((j) => j.status === "FALHA");

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 250);
  };

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  if (totalJobsCount === 0) return null;

  // CASO 1: Apenas 1 trabalho ativo no total -> Renderiza chip único direto e elegante
  if (totalJobsCount === 1) {
    if (relatorioJobs.length === 1) {
      const job = relatorioJobs[0];
      if (job.status === "A_GERAR") {
        return (
          <span
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
          <span className="inline-flex items-center gap-0.5 rounded-full border border-emerald-400/40 bg-emerald-500/10 text-[11px] font-medium text-emerald-200 shadow-sm">
            <button
              type="button"
              onClick={() => descarregarRelatorio(job.id)}
              className="inline-flex items-center gap-1.5 rounded-l-full px-2.5 py-1 transition-colors hover:bg-emerald-500/20"
              title="Descarregar relatório gerado"
            >
              <FileDown className="h-3 w-3 text-emerald-400" />
              <span className="max-w-[10rem] truncate font-semibold">
                Relatório {job.secaoLabel}: descarregar
              </span>
            </button>
            <button
              type="button"
              onClick={() => descartarRelatorio(job.id)}
              className="rounded-r-full px-1.5 py-1 text-emerald-300/80 transition-colors hover:bg-emerald-500/25 hover:text-emerald-100"
              title="Fechar"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        );
      }
      if (job.status === "FALHA") {
        return (
          <span className="inline-flex items-center gap-0.5 rounded-full border border-amber-400/40 bg-amber-500/10 text-[11px] font-medium text-amber-200 shadow-sm">
            <button
              type="button"
              onClick={() => void gerarRelatorio(job.secao)}
              className="inline-flex items-center gap-1.5 rounded-l-full px-2.5 py-1 transition-colors hover:bg-amber-500/20"
              title="Falha no relatório. Clique para tentar novamente."
            >
              <AlertTriangle className="h-3 w-3 text-amber-400" />
              <span className="max-w-[10rem] truncate">
                Relatório {job.secaoLabel}: tentar de novo
              </span>
            </button>
            <button
              type="button"
              onClick={() => descartarRelatorio(job.id)}
              className="rounded-r-full px-1.5 py-1 text-amber-300/80 transition-colors hover:bg-amber-500/25 hover:text-amber-100"
              title="Descartar"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        );
      }
    }

    if (activeCronogramas.length === 1) {
      const job = activeCronogramas[0];
      if (job.status === "A_PROCESSAR") {
        return (
          <span
            className="cronograma-ia-chip-processing inline-flex items-center gap-1.5 rounded-full border border-violet-400/40 bg-violet-500/10 px-2.5 py-1 text-[11px] font-medium text-violet-200 shadow-sm"
            title={`A analisar cronograma com IA…`}
          >
            <Loader2 className="h-3 w-3 animate-spin text-violet-400" />
            <span className="max-w-[10rem] truncate">
              {job.acaoFormacao?.codigoInterno ?? "Cronograma"}: a analisar…
            </span>
          </span>
        );
      }
      if (job.status === "RASCUNHO") {
        return (
          <span className="cronograma-ia-chip-ready inline-flex items-center gap-0.5 rounded-full border border-emerald-400/40 bg-emerald-500/10 text-[11px] font-medium text-emerald-200 shadow-sm">
            <button
              type="button"
              onClick={() =>
                router.push(
                  `/portal/acoes/${job.acaoFormacaoId}?tab=cronograma&importJob=${job.id}`,
                )
              }
              className="inline-flex items-center gap-1.5 rounded-l-full px-2.5 py-1 transition-colors hover:bg-emerald-500/20"
              title="Rascunho pronto - clique para revisar"
            >
              <Sparkles className="h-3 w-3 text-emerald-400" />
              <span className="max-w-[10rem] truncate font-semibold">
                {job.acaoFormacao?.codigoInterno ?? "Cronograma"}: rascunho pronto
              </span>
            </button>
            <button
              type="button"
              disabled={busyCronogramaId === job.id}
              onClick={() => void descartarCronograma(job.id)}
              className="rounded-r-full px-1.5 py-1 text-emerald-300/80 transition-colors hover:bg-emerald-500/25 hover:text-emerald-100"
              title="Descartar"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        );
      }
      if (job.status === "FALHA") {
        return (
          <span className="inline-flex items-center gap-0.5 rounded-full border border-amber-400/40 bg-amber-500/10 text-[11px] font-medium text-amber-200 shadow-sm">
            <button
              type="button"
              onClick={() =>
                router.push(`/portal/acoes/${job.acaoFormacaoId}?tab=cronograma`)
              }
              className="inline-flex items-center gap-1.5 rounded-l-full px-2.5 py-1 transition-colors hover:bg-amber-500/20"
              title={job.erro ?? "Falha ao analisar cronograma"}
            >
              <AlertTriangle className="h-3 w-3 text-amber-400" />
              <span className="max-w-[10rem] truncate">
                {job.acaoFormacao?.codigoInterno ?? "Cronograma"}: falhou
              </span>
            </button>
            <button
              type="button"
              disabled={busyCronogramaId === job.id}
              onClick={() => void descartarCronograma(job.id)}
              className="rounded-r-full px-1.5 py-1 text-amber-300/80 transition-colors hover:bg-amber-500/25 hover:text-amber-100"
              title="Descartar"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        );
      }
    }
  }

  // CASO 2: Mais do que 1 trabalho em simultâneo -> Box suspensa agrupada com efeito Hover
  return (
    <div
      ref={containerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="relative z-[100] inline-block"
    >
      {/* Gatilho / Badge Agrupado */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold transition-all shadow-md backdrop-blur-md cursor-pointer",
          hasProcessing
            ? "border-violet-400/50 bg-violet-950/50 text-violet-200 ring-1 ring-violet-500/30 hover:bg-violet-900/60"
            : hasFailures
              ? "border-amber-400/50 bg-amber-950/50 text-amber-200 ring-1 ring-amber-500/30 hover:bg-amber-900/60"
              : "border-emerald-400/50 bg-emerald-950/50 text-emerald-200 ring-1 ring-emerald-500/30 hover:bg-emerald-900/60",
        )}
        title="Ver todos os trabalhos em background"
      >
        {hasProcessing ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-400" />
        ) : hasFailures ? (
          <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
        ) : (
          <Zap className="h-3.5 w-3.5 text-emerald-400" />
        )}
        <span>{totalJobsCount} trabalhos em background</span>
        <ChevronDown
          className={cn(
            "h-3 w-3 opacity-70 transition-transform duration-200",
            isOpen && "rotate-180",
          )}
        />
      </button>

      {/* Box Flutuante Aberta no Hover */}
      {isOpen ? (
        <div
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-2xl border border-slate-700/60 bg-slate-950/95 p-3.5 text-xs text-slate-200 shadow-2xl shadow-black/90 backdrop-blur-2xl ring-1 ring-slate-700/40 animate-in fade-in zoom-in-95 duration-150 z-[100]"
        >
          {/* Header da Box */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 mb-2.5">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500/20 text-blue-400">
                <Zap className="h-3 w-3" />
              </span>
              <span className="font-semibold text-slate-100">
                Trabalhos em background
              </span>
            </div>
            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-400">
              {totalJobsCount} ativos
            </span>
          </div>

          {/* Lista de Trabalhos */}
          <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
            {/* Relatórios PDF */}
            {relatorioJobs.map((job) => (
              <div
                key={job.id}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-xl border p-2.5 transition-all",
                  job.status === "A_GERAR"
                    ? "border-violet-500/30 bg-violet-950/20 hover:bg-violet-950/30"
                    : job.status === "PRONTO"
                      ? "border-emerald-500/30 bg-emerald-950/20 hover:bg-emerald-950/30"
                      : "border-amber-500/30 bg-amber-950/20 hover:bg-amber-950/30",
                )}
              >
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-slate-800/80 text-slate-300">
                    <FileText className="h-3.5 w-3.5 text-violet-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate font-medium text-slate-200">
                        Relatório {job.secaoLabel}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 truncate">
                      {job.status === "A_GERAR" && "A gerar análise e PDF…"}
                      {job.status === "PRONTO" && "Pronto para descarregar"}
                      {job.status === "FALHA" && (job.erro ?? "Falha ao gerar")}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {job.status === "A_GERAR" ? (
                    <span className="flex items-center gap-1 text-[11px] font-medium text-violet-300">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    </span>
                  ) : null}

                  {job.status === "PRONTO" ? (
                    <button
                      type="button"
                      onClick={() => descarregarRelatorio(job.id)}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-500 transition-colors shadow-sm"
                    >
                      <FileDown className="h-3 w-3" /> Descarregar
                    </button>
                  ) : null}

                  {job.status === "FALHA" ? (
                    <button
                      type="button"
                      onClick={() => void gerarRelatorio(job.secao)}
                      className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-amber-500 transition-colors"
                    >
                      <RefreshCw className="h-3 w-3" /> Tentar
                    </button>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => descartarRelatorio(job.id)}
                    className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
                    title="Descartar"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}

            {/* Cronogramas IA */}
            {activeCronogramas.map((job) => (
              <div
                key={job.id}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-xl border p-2.5 transition-all",
                  job.status === "A_PROCESSAR"
                    ? "border-violet-500/30 bg-violet-950/20 hover:bg-violet-950/30"
                    : job.status === "RASCUNHO"
                      ? "border-emerald-500/30 bg-emerald-950/20 hover:bg-emerald-950/30"
                      : "border-amber-500/30 bg-amber-950/20 hover:bg-amber-950/30",
                )}
              >
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-slate-800/80 text-slate-300">
                    <Calendar className="h-3.5 w-3.5 text-blue-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate font-medium text-slate-200">
                        {job.acaoFormacao?.codigoInterno ?? "Cronograma"}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 truncate">
                      {job.status === "A_PROCESSAR" && "A analisar com IA…"}
                      {job.status === "RASCUNHO" && "Rascunho de IA pronto"}
                      {job.status === "FALHA" && (job.erro ?? "Falha na análise")}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {job.status === "A_PROCESSAR" ? (
                    <span className="flex items-center gap-1 text-[11px] font-medium text-violet-300">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    </span>
                  ) : null}

                  {job.status === "RASCUNHO" ? (
                    <button
                      type="button"
                      onClick={() => {
                        setIsOpen(false);
                        router.push(
                          `/portal/acoes/${job.acaoFormacaoId}?tab=cronograma&importJob=${job.id}`,
                        );
                      }}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-500 transition-colors shadow-sm"
                    >
                      <Sparkles className="h-3 w-3" /> Revisar
                    </button>
                  ) : null}

                  {job.status === "FALHA" ? (
                    <button
                      type="button"
                      onClick={() => {
                        setIsOpen(false);
                        router.push(
                          `/portal/acoes/${job.acaoFormacaoId}?tab=cronograma`,
                        );
                      }}
                      className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-amber-500 transition-colors"
                    >
                      Ver
                    </button>
                  ) : null}

                  <button
                    type="button"
                    disabled={busyCronogramaId === job.id}
                    onClick={() => void descartarCronograma(job.id)}
                    className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors disabled:opacity-50"
                    title="Descartar"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
