"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Video } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import {
  buildMonthGridCells,
  dayFromDateKey,
  formatDateKeyPt,
  formatLocalDateKey,
  toDateKey,
} from "@/lib/calendar-date";
import { PageContentSkeleton } from "@/components/ui/page-skeleton";
import { Button } from "@/components/ui/button";

type SessaoRow = {
  id: string;
  matriculaId: string;
  numeroSessao: number;
  data: string;
  horaInicio: string;
  horaFim: string;
  modalidade: string;
  iniciadaEm?: string | null;
  terminadaEm: string | null;
  requerSalaOnline: boolean;
  turma: string;
  acao: string;
  acaoCodigo?: string;
};

function estadoSessao(s: SessaoRow) {
  if (s.terminadaEm) return "CONCLUIDA";
  if (s.iniciadaEm) return "EM_CURSO";
  const hoje = formatLocalDateKey(new Date());
  const d = toDateKey(s.data);
  if (d < hoje) return "PASSADA";
  if (d === hoje) return "HOJE";
  return "AGENDADA";
}

export function FormandoCalendarioView() {
  const [eventos, setEventos] = useState<SessaoRow[]>([]);
  const [mesAtual, setMesAtual] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const r = await bffFetch("/api/v1/lms/minhas-sessoes", { headers: { accept: "application/json" } });
    if (!r.ok) {
      setError(r.status === 403 ? "Área reservada a formandos." : "Erro ao carregar sessões.");
      setEventos([]);
      setLoading(false);
      return;
    }
    const blocks = (await r.json()) as Array<{
      matriculaId: string;
      turma: string;
      acao: string;
      sessoes: Array<{
        id: string;
        numeroSessao: number;
        data: string;
        horaInicio: string;
        horaFim: string;
        modalidade: string;
        iniciadaEm?: string | null;
        terminadaEm: string | null;
        requerSalaOnline: boolean;
      }>;
    }>;

    const rows: SessaoRow[] = [];
    for (const b of blocks) {
      const codigo = b.turma.split(" – ")[0] ?? b.turma;
      for (const s of b.sessoes) {
        rows.push({
          ...s,
          matriculaId: b.matriculaId,
          turma: b.turma,
          acao: b.acao,
          acaoCodigo: codigo,
        });
      }
    }
    setEventos(rows);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const ano = mesAtual.getFullYear();
  const mes = mesAtual.getMonth();
  const hoje = formatLocalDateKey(new Date());

  const dias = useMemo(() => buildMonthGridCells(ano, mes), [ano, mes]);

  const eventosDoDia = (data: string) =>
    eventos.filter((e) => toDateKey(e.data) === data).sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));

  if (loading) {
    return <PageContentSkeleton variant="default" />;
  }

  return (
    <div className="max-w-4xl mx-auto px-5 py-8 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-50">Calendário</h1>
        <p className="text-sm text-slate-400 mt-1">
          Sessões das tuas formações inscritas - presencial ou online.
        </p>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-500/25 bg-red-950/30 px-4 py-3 text-sm text-red-300">{error}</p>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-700/30 bg-slate-900/50">
        <div className="flex items-center justify-between border-b border-slate-700/30 px-4 py-3 sm:px-5">
          <button
            type="button"
            onClick={() => setMesAtual(new Date(ano, mes - 1, 1))}
            className="rounded-lg border border-slate-600/40 px-3 py-1.5 text-sm text-slate-400 transition-colors hover:bg-slate-800/40"
          >
            ← {new Date(ano, mes - 1).toLocaleDateString("pt-PT", { month: "short" })}
          </button>
          <h2 className="text-base font-bold text-slate-100 sm:text-lg">
            {new Date(ano, mes, 1).toLocaleDateString("pt-PT", { month: "long", year: "numeric" })}
          </h2>
          <button
            type="button"
            onClick={() => setMesAtual(new Date(ano, mes + 1, 1))}
            className="rounded-lg border border-slate-600/40 px-3 py-1.5 text-sm text-slate-400 transition-colors hover:bg-slate-800/40"
          >
            {new Date(ano, mes + 1).toLocaleDateString("pt-PT", { month: "short" })} →
          </button>
        </div>

        <div className="grid grid-cols-7 text-center">
          {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((d) => (
            <div
              key={d}
              className="border-b border-slate-700/20 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 sm:text-[11px]"
            >
              {d}
            </div>
          ))}
          {dias.map((data, i) => (
            <button
              key={i}
              type="button"
              disabled={!data}
              onClick={() => setSelectedDate(selectedDate === data ? null : data)}
              className={`min-h-[64px] border border-slate-700/10 p-1 text-left transition-colors sm:min-h-[72px] sm:p-1.5 ${
                !data
                  ? "bg-slate-900/30"
                  : data === hoje
                    ? "bg-blue-500/5"
                    : data === selectedDate
                      ? "bg-blue-500/10 ring-1 ring-blue-500/30"
                      : "hover:bg-slate-800/30"
              }`}
            >
              {data ? (
                <>
                  <span
                    className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                      data === hoje ? "bg-blue-600 text-white" : "text-slate-400"
                    }`}
                  >
                    {dayFromDateKey(data)}
                  </span>
                  {eventosDoDia(data).length > 0 ? (
                    <div className="mt-1 space-y-0.5">
                      {eventosDoDia(data)
                        .slice(0, 2)
                        .map((e) => (
                          <div
                            key={e.id}
                            className="truncate rounded bg-blue-500/15 px-1 py-0.5 text-[8px] leading-tight text-blue-300 sm:text-[9px]"
                          >
                            S{e.numeroSessao} {e.horaInicio}
                          </div>
                        ))}
                      {eventosDoDia(data).length > 2 ? (
                        <div className="px-1 text-[8px] text-slate-500 sm:text-[9px]">
                          +{eventosDoDia(data).length - 2}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      {selectedDate ? (
        <div className="rounded-2xl border border-slate-700/30 bg-slate-900/50 p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-200">
            Sessões de {formatDateKeyPt(selectedDate)}
          </h3>
          {eventosDoDia(selectedDate).length === 0 ? (
            <p className="text-sm text-slate-500">Sem sessões neste dia.</p>
          ) : (
            <div className="space-y-2">
              {eventosDoDia(selectedDate).map((e) => {
                const est = estadoSessao(e);
                return (
                  <div
                    key={`${e.matriculaId}-${e.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-700/20 bg-slate-800/40 p-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-200">{e.acao}</p>
                      <p className="text-xs text-slate-500">
                        {e.turma} · Sessão {e.numeroSessao} · {e.horaInicio}–{e.horaFim} · {e.modalidade}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-medium ${
                          est === "CONCLUIDA"
                            ? "bg-green-500/10 text-green-400"
                            : est === "EM_CURSO"
                              ? "bg-teal-500/10 text-teal-300"
                            : est === "HOJE"
                              ? "bg-blue-500/10 text-blue-300"
                              : est === "PASSADA"
                                ? "bg-slate-500/10 text-slate-500"
                                : "bg-amber-500/10 text-amber-300"
                        }`}
                      >
                        {est === "CONCLUIDA"
                          ? "Concluída"
                          : est === "EM_CURSO"
                            ? "Em curso"
                          : est === "HOJE"
                            ? "Hoje"
                            : est === "PASSADA"
                              ? "Passada"
                              : "Agendada"}
                      </span>
                      {e.requerSalaOnline && (est === "EM_CURSO" || est === "HOJE") ? (
                        <Button size="sm" variant="secondary" asChild>
                          <Link
                            href={`/portal/formando/reuniao?matriculaId=${encodeURIComponent(e.matriculaId)}&sessaoFormacaoId=${encodeURIComponent(e.id)}`}
                          >
                            <Video className="h-3.5 w-3.5" />
                            Entrar
                          </Link>
                        </Button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}

      {!loading && !error && eventos.length === 0 ? (
        <p className="text-center text-sm text-slate-500">
          Ainda não tens sessões agendadas. Explora o{" "}
          <Link href="/portal/formando/catalogo" className="text-blue-400 hover:text-blue-300">
            catálogo
          </Link>{" "}
          para te inscreveres.
        </p>
      ) : null}
    </div>
  );
}
