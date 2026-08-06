"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BookOpen, CheckCircle2, ChevronDown, ChevronRight, Users } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { parseApiError } from "@/lib/ui/backoffice";
import { cn } from "@/lib/ui/cn";
import { Alert, Card, CardContent, CardHeader, CardTitle, PageHeader } from "@/components/ui";
import { PageContentSkeleton } from "@/components/ui/page-skeleton";

type FormandoProgresso = {
  matriculaId: string;
  nome: string;
  percentual: number;
  concluidas: number;
  total: number;
  completo?: boolean;
};

type AcaoProgresso = {
  acaoId: string;
  codigoInterno: string;
  titulo: string;
  cursoDesignacao: string;
  percentualMedio: number;
  formandos: number;
  concluidas: number;
  totalTarefas: number;
  formandosDetalhe: FormandoProgresso[];
};

type ResumoProgresso = {
  geral: {
    percentual: number;
    concluidas: number;
    totalTarefas: number;
    formandosAtivos: number;
  };
  acoes: AcaoProgresso[];
};

type TarefaDetalhe = {
  id: string;
  titulo: string;
  tipo: string;
  concluido: boolean;
  percentual: number;
  desbloqueado: boolean;
};

type DetalhePayload = {
  matriculaId: string;
  formando: { nome: string; nif: string; email: string | null };
  turma: { codigo: string; nome: string };
  acao: {
    id: string;
    codigoInterno: string;
    titulo: string;
    cursoDesignacao: string;
  };
  percurso: {
    tarefas: TarefaDetalhe[];
    prazoLms: {
      percentualConclusao: number;
      concluidos: number;
      total: number;
      completo: boolean;
    } | null;
  };
};

function progressColor(pct: number) {
  if (pct >= 80) return "bg-emerald-500";
  if (pct >= 50) return "bg-amber-500";
  return "bg-red-500";
}

function ProgressBar({ value, className }: { value: number; className?: string }) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-slate-800", className)}>
      <div
        className={cn("h-full rounded-full transition-all duration-500", progressColor(pct))}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function ProgressoLmsContent() {
  const searchParams = useSearchParams();
  const acaoFromUrl = searchParams.get("acao");
  const matriculaFromUrl = searchParams.get("matricula");

  const [data, setData] = useState<ResumoProgresso | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedAcao, setExpandedAcao] = useState<string | null>(acaoFromUrl);
  const [selectedMatricula, setSelectedMatricula] = useState<string | null>(matriculaFromUrl);
  const [detalhe, setDetalhe] = useState<DetalhePayload | null>(null);
  const [detalheLoading, setDetalheLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await bffFetch("/api/v1/conteudos-lms/formador/progresso-resumo", {
      headers: { accept: "application/json" },
    });
    if (!res.ok) {
      setError(await parseApiError(res));
      setData(null);
      setLoading(false);
      return;
    }
    setData((await res.json()) as ResumoProgresso);
    setLoading(false);
  }, []);

  const loadDetalhe = useCallback(async (matriculaId: string) => {
    setDetalheLoading(true);
    setSelectedMatricula(matriculaId);
    const res = await bffFetch(
      `/api/v1/conteudos-lms/formador/progresso-detalhe?matriculaId=${encodeURIComponent(matriculaId)}`,
      { headers: { accept: "application/json" } },
    );
    if (!res.ok) {
      setError(await parseApiError(res));
      setDetalhe(null);
      setDetalheLoading(false);
      return;
    }
    setDetalhe((await res.json()) as DetalhePayload);
    setDetalheLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (matriculaFromUrl) void loadDetalhe(matriculaFromUrl);
  }, [matriculaFromUrl, loadDetalhe]);

  useEffect(() => {
    if (acaoFromUrl) setExpandedAcao(acaoFromUrl);
  }, [acaoFromUrl]);

  if (loading) return <PageContentSkeleton />;

  return (
    <>
      <PageHeader
        title="Progresso LMS"
        description="Acompanha o progresso de cada formando nas acções que instruis. Recebes uma notificação quando alguém conclui todas as tarefas."
      />

      {error ? <Alert variant="error" className="mb-4">{error}</Alert> : null}

      {!data ? null : (
        <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <BookOpen className="h-4 w-4 text-teal-400" />
                  Resumo
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-0">
                <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-4">
                  <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
                    <p className={cn("text-2xl font-bold tabular-nums", data.geral.percentual >= 50 ? "text-teal-300" : "text-amber-300")}>
                      {data.geral.percentual}%
                    </p>
                    <div className="flex gap-4 text-xs text-slate-400">
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {data.geral.formandosAtivos} formandos
                      </span>
                      <span>
                        {data.geral.concluidas}/{data.geral.totalTarefas} conclusões
                      </span>
                    </div>
                  </div>
                  <ProgressBar value={data.geral.percentual} />
                </div>

                {data.acoes.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    Sem acções atribuídas ou sem conteúdos LMS publicados.
                  </p>
                ) : (
                  data.acoes.map((acao) => {
                    const expanded = expandedAcao === acao.acaoId;
                    return (
                      <div
                        key={acao.acaoId}
                        className="rounded-xl border border-slate-700/40 bg-slate-900/30 p-3"
                      >
                        <button
                          type="button"
                          className="flex w-full items-start gap-2 text-left"
                          onClick={() =>
                            setExpandedAcao((id) => (id === acao.acaoId ? null : acao.acaoId))
                          }
                        >
                          {expanded ? (
                            <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                          ) : (
                            <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-slate-100">{acao.codigoInterno}</p>
                            <p className="truncate text-xs text-slate-500">{acao.titulo}</p>
                            <p className="text-[11px] text-slate-600">{acao.cursoDesignacao}</p>
                            <ProgressBar value={acao.percentualMedio} className="mt-2" />
                          </div>
                          <div className="text-right text-xs text-slate-400">
                            <p className="font-semibold tabular-nums text-slate-200">
                              {acao.percentualMedio}%
                            </p>
                            <p>
                              {acao.formandos} formando{acao.formandos === 1 ? "" : "s"}
                            </p>
                          </div>
                        </button>

                        {expanded ? (
                          <ul className="mt-3 space-y-1.5 border-t border-slate-800/80 pt-3">
                            {acao.formandosDetalhe.map((f) => (
                              <li key={f.matriculaId}>
                                <button
                                  type="button"
                                  onClick={() => void loadDetalhe(f.matriculaId)}
                                  className={cn(
                                    "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors",
                                    selectedMatricula === f.matriculaId
                                      ? "bg-teal-500/10 ring-1 ring-teal-500/30"
                                      : "hover:bg-slate-800/50",
                                  )}
                                >
                                  <span className="min-w-0 flex-1 truncate text-sm text-slate-200">
                                    {f.nome}
                                    {f.completo ? (
                                      <CheckCircle2 className="ml-1.5 inline h-3.5 w-3.5 text-emerald-400" />
                                    ) : null}
                                  </span>
                                  <span className="shrink-0 text-[11px] tabular-nums text-slate-500">
                                    {f.concluidas}/{f.total}
                                  </span>
                                  <div className="w-20">
                                    <ProgressBar value={f.percentual} />
                                  </div>
                                  <span className="w-10 shrink-0 text-right text-xs tabular-nums text-slate-400">
                                    {f.percentual}%
                                  </span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="h-fit lg:sticky lg:top-4">
            <CardHeader>
              <CardTitle className="text-sm">Detalhe do formando</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {detalheLoading ? (
                <p className="text-sm text-slate-500">A carregar…</p>
              ) : !detalhe ? (
                <p className="text-sm text-slate-500">
                  Selecciona um formando para ver o estado de cada tarefa.
                </p>
              ) : (
                <div className="space-y-4">
                  <div>
                    <p className="text-base font-semibold text-slate-100">{detalhe.formando.nome}</p>
                    <p className="text-xs text-slate-500">
                      {detalhe.acao.codigoInterno} · {detalhe.turma.codigo}
                      {detalhe.formando.email ? ` · ${detalhe.formando.email}` : ""}
                    </p>
                    {detalhe.percurso.prazoLms ? (
                      <p className="mt-2 text-sm text-slate-300">
                        {detalhe.percurso.prazoLms.completo ? (
                          <span className="inline-flex items-center gap-1 text-emerald-300">
                            <CheckCircle2 className="h-4 w-4" />
                            Percurso completo (
                            {detalhe.percurso.prazoLms.percentualConclusao}%)
                          </span>
                        ) : (
                          <span>
                            {detalhe.percurso.prazoLms.concluidos}/
                            {detalhe.percurso.prazoLms.total} tarefas ·{" "}
                            {detalhe.percurso.prazoLms.percentualConclusao}%
                          </span>
                        )}
                      </p>
                    ) : null}
                  </div>
                  <ul className="divide-y divide-slate-800/80 rounded-xl border border-slate-700/40">
                    {detalhe.percurso.tarefas.map((t) => (
                      <li
                        key={t.id}
                        className="flex items-center gap-3 px-3 py-2.5 text-sm"
                      >
                        {t.concluido ? (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                        ) : (
                          <span className="h-4 w-4 shrink-0 rounded-full border border-slate-600" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-slate-200">{t.titulo}</p>
                          <p className="text-[11px] uppercase tracking-wide text-slate-500">
                            {t.tipo}
                            {!t.desbloqueado && !t.concluido ? " · bloqueada" : ""}
                          </p>
                        </div>
                        <span className="tabular-nums text-xs text-slate-400">{t.percentual}%</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}

export default function ProgressoLmsPage() {
  return (
    <Suspense fallback={<PageContentSkeleton />}>
      <ProgressoLmsContent />
    </Suspense>
  );
}
