"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { bffQuery } from "@/lib/client/bff-query";
import { parseApiError } from "@/lib/ui/backoffice";
import {
  buildMonthGridCells,
  dayFromDateKey,
  formatDateKeyPt,
  formatLocalDateKey,
  monthLoadRange,
} from "@/lib/calendar-date";
import { PageContentSkeleton } from "@/components/ui/page-skeleton";

type SessaoRow = {
  id: string;
  numeroSessao: number;
  data: string;
  horaInicio: string;
  horaFim: string;
  modalidade: string;
  estado: string;
  acaoCodigo: string;
  acaoTitulo: string;
};

export function FormandoCalendarioView() {
  const [eventos, setEventos] = useState<SessaoRow[]>([]);
  const [mesAtual, setMesAtual] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const ano = mesAtual.getFullYear();
  const mes = mesAtual.getMonth();
  const hoje = formatLocalDateKey(new Date());
  const dias = useMemo(() => buildMonthGridCells(ano, mes), [ano, mes]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { inicio, fim } = monthLoadRange(ano, mes);

    try {
      const r = await bffQuery("/api/v1/calendario/eventos", {
        body: { inicio, fim },
      });
      if (!r.ok) {
        setError(await parseApiError(r));
        setEventos([]);
        return;
      }
      const rows = (await r.json()) as Array<{
        id: string;
        tipo: string;
        titulo: string;
        subtitulo?: string;
        data: string;
        horaInicio: string;
        horaFim?: string;
        modalidade?: string;
        estado?: string;
        numeroSessao?: number;
      }>;
      setEventos(
        rows
          .filter((e) => e.tipo === "SESSAO_FORMACAO")
          .map((e) => ({
            id: e.id.replace(/^sessao-/, ""),
            numeroSessao: e.numeroSessao ?? 0,
            data: e.data,
            horaInicio: e.horaInicio,
            horaFim: e.horaFim ?? "",
            modalidade: e.modalidade ?? "",
            estado: e.estado ?? "AGENDADA",
            acaoCodigo: e.titulo.split("–")[0]?.trim() ?? "-",
            acaoTitulo: e.subtitulo ?? e.titulo,
          })),
      );
    } catch {
      setError("Erro ao carregar sessões.");
      setEventos([]);
    } finally {
      setLoading(false);
    }
  }, [ano, mes]);

  useEffect(() => {
    void load();
  }, [load]);

  const eventosDoDia = (data: string) =>
    eventos.filter((e) => e.data === data).sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));

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

      <div className="overflow-x-auto rounded-2xl border border-slate-700/30 bg-slate-900/50">
        <div className="flex min-w-[280px] flex-wrap items-center justify-between gap-2 border-b border-slate-700/30 px-3 py-3 sm:px-5">
          <button
            type="button"
            onClick={() => setMesAtual(new Date(ano, mes - 1, 1))}
            className="rounded-lg border border-slate-600/40 px-2 py-1.5 text-xs text-slate-400 transition-colors hover:bg-slate-800/40 sm:px-3 sm:text-sm"
          >
            ← {new Date(ano, mes - 1).toLocaleDateString("pt-PT", { month: "short" })}
          </button>
          <h2 className="text-sm font-bold text-slate-100 sm:text-lg">
            {new Date(ano, mes, 1).toLocaleDateString("pt-PT", { month: "long", year: "numeric" })}
          </h2>
          <button
            type="button"
            onClick={() => setMesAtual(new Date(ano, mes + 1, 1))}
            className="rounded-lg border border-slate-600/40 px-2 py-1.5 text-xs text-slate-400 transition-colors hover:bg-slate-800/40 sm:px-3 sm:text-sm"
          >
            {new Date(ano, mes + 1).toLocaleDateString("pt-PT", { month: "short" })} →
          </button>
        </div>

        <div className="grid min-w-[280px] grid-cols-7 text-center">
          {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((d) => (
            <div
              key={d}
              className="border-b border-slate-700/20 py-1.5 text-[9px] font-semibold uppercase tracking-wider text-slate-500 sm:py-2 sm:text-[11px]"
            >
              <span className="sm:hidden">{d.charAt(0)}</span>
              <span className="hidden sm:inline">{d}</span>
            </div>
          ))}
          {dias.map((data, i) => (
            <button
              key={i}
              type="button"
              disabled={!data}
              onClick={() => data && setSelectedDate(selectedDate === data ? null : data)}
              className={`min-h-[52px] border border-slate-700/10 p-1 text-left transition-colors sm:min-h-[72px] sm:p-1.5 ${
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
              {eventosDoDia(selectedDate).map((e) => (
                <div
                  key={e.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-700/20 bg-slate-800/40 p-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-200">
                      {e.acaoCodigo} – {e.acaoTitulo}
                    </p>
                    <p className="text-xs text-slate-500">
                      Sessão {e.numeroSessao} · {e.horaInicio}–{e.horaFim} · {e.modalidade}
                    </p>
                  </div>
                  <span className="rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-300">
                    {e.estado}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {!error && eventos.length === 0 ? (
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
