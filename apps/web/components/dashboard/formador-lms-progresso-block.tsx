"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, BookOpen, Users } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { cn } from "@/lib/ui/cn";

type FormandoProgresso = {
  matriculaId: string;
  nome: string;
  percentual: number;
  concluidas: number;
  total: number;
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

export function FormadorLmsProgressoBlock() {
  const [data, setData] = useState<ResumoProgresso | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedAcao, setExpandedAcao] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await bffFetch("/api/v1/conteudos-lms/formador/progresso-resumo", {
      headers: { accept: "application/json" },
    });
    if (res.ok) {
      setData((await res.json()) as ResumoProgresso);
    } else {
      setData(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <BookOpen className="h-4 w-4 text-teal-400" />
            Progresso LMS dos formandos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="h-3 w-full animate-pulse rounded-full bg-slate-800" />
            <div className="h-16 animate-pulse rounded-lg bg-slate-800/60" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const { geral, acoes } = data;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-sm">
            <BookOpen className="h-4 w-4 text-teal-400" />
            Progresso LMS dos formandos
          </CardTitle>
          <p className="mt-1 text-xs text-slate-500">
            Conteúdos concluídos nas acções em que estás atribuído.
          </p>
        </div>
        <Link
          href="/portal/conteudos"
          className="inline-flex shrink-0 items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
        >
          Conteúdos <ArrowRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent className="space-y-5 pt-0">
        <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-4">
          <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Progresso geral
              </p>
              <p className={cn("text-2xl font-bold tabular-nums", geral.percentual >= 50 ? "text-teal-300" : "text-amber-300")}>
                {geral.percentual}%
              </p>
            </div>
            <div className="flex gap-4 text-xs text-slate-400">
              <span className="inline-flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {geral.formandosAtivos} formando{geral.formandosAtivos === 1 ? "" : "s"}
              </span>
              <span>
                {geral.concluidas}/{geral.totalTarefas} conclusões
              </span>
            </div>
          </div>
          <ProgressBar value={geral.percentual} />
        </div>

        {acoes.length === 0 ? (
          <p className="text-sm text-slate-500">
            Sem acções atribuídas ou sem formandos matriculados com conteúdos LMS publicados.
          </p>
        ) : (
          <div className="space-y-3">
            {acoes.map((acao) => {
              const expanded = expandedAcao === acao.acaoId;
              return (
                <div
                  key={acao.acaoId}
                  className="rounded-xl border border-slate-700/40 bg-slate-900/30 p-3"
                >
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() =>
                      setExpandedAcao((id) => (id === acao.acaoId ? null : acao.acaoId))
                    }
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link
                          href={`/portal/acoes/${acao.acaoId}?tab=cronograma`}
                          onClick={(e) => e.stopPropagation()}
                          className="font-medium text-slate-100 hover:text-blue-300"
                        >
                          {acao.codigoInterno}
                        </Link>
                        <p className="truncate text-xs text-slate-500">{acao.titulo}</p>
                        <p className="text-[11px] text-slate-600">{acao.cursoDesignacao}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold tabular-nums text-slate-200">
                          {acao.percentualMedio}%
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {acao.formandos} formando{acao.formandos === 1 ? "" : "s"} · {acao.totalTarefas} conteúdos
                        </p>
                      </div>
                    </div>
                    <ProgressBar value={acao.percentualMedio} className="mt-2" />
                  </button>

                  {expanded && acao.formandosDetalhe.length > 0 ? (
                    <ul className="mt-3 space-y-2 border-t border-slate-800/80 pt-3">
                      {acao.formandosDetalhe.map((f) => (
                        <li key={f.matriculaId} className="flex items-center gap-3">
                          <span className="min-w-0 flex-1 truncate text-xs text-slate-300">{f.nome}</span>
                          <span className="shrink-0 text-[11px] tabular-nums text-slate-500">
                            {f.concluidas}/{f.total}
                          </span>
                          <div className="w-24">
                            <ProgressBar value={f.percentual} />
                          </div>
                          <span className="w-10 shrink-0 text-right text-xs tabular-nums text-slate-400">
                            {f.percentual}%
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
