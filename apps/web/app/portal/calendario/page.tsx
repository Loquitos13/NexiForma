"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { bffQuery } from "@/lib/client/bff-query";
import {
  buildMonthGridCells,
  dayFromDateKey,
  formatDateKeyPt,
  formatLocalDateKey,
  monthLoadRange,
} from "@/lib/calendar-date";

type SessaoEvent = {
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

export default function CalendarioPage() {
  const [eventos, setEventos] = useState<SessaoEvent[]>([]);
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
        setError(r.status === 403 ? "Sem permissão para o calendário." : "Erro ao carregar calendário.");
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
        numeroSessao?: number;
        estado?: string;
      }>;
      setEventos(
        rows.map((e) => ({
          id: e.id,
          numeroSessao: e.numeroSessao ?? 0,
          data: e.data,
          horaInicio: e.horaInicio,
          horaFim: e.horaFim ?? "",
          modalidade: e.modalidade ?? (e.tipo === "REUNIAO_CRM" ? "CRM" : ""),
          estado: e.estado ?? "AGENDADA",
          acaoCodigo: e.tipo === "REUNIAO_CRM" ? "CRM" : e.titulo.split("–")[0]?.trim() ?? "-",
          acaoTitulo: e.subtitulo ?? e.titulo,
        })),
      );
    } catch {
      setError("Erro ao carregar calendário.");
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

  const temEventos = (data: string) => eventosDoDia(data).length > 0;

  return (
    <div className="max-w-5xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-50">Calendario</h1>
        <p className="text-sm text-slate-500 mt-1">
          Sessões de formação, reuniões CRM e eventos agendados - vista por perfil.
        </p>
      </div>

      {error ? (
        <div className="flex items-start gap-2.5 rounded-xl bg-red-950/40 border border-red-500/25 px-4 py-3">
          <p className="text-sm text-red-300">{error}</p>
        </div>
      ) : null}

      <div className="rounded-2xl bg-slate-900/50 border border-slate-700/30 overflow-x-auto">
        <div className="flex min-w-[280px] flex-wrap items-center justify-between gap-2 px-3 py-3 sm:px-5 sm:py-4 border-b border-slate-700/30">
          <button
            type="button"
            onClick={() => setMesAtual(new Date(ano, mes - 1, 1))}
            className="px-2 py-1.5 sm:px-3 rounded-lg border border-slate-600/40 text-xs sm:text-sm text-slate-400 hover:bg-slate-800/40 transition-colors"
          >
            ← <span className="hidden sm:inline">{new Date(ano, mes - 1, 1).toLocaleDateString("pt-PT", { month: "short" })}</span>
          </button>
          <h2 className="text-sm sm:text-lg font-bold text-slate-100 text-center">
            {new Date(ano, mes, 1).toLocaleDateString("pt-PT", { month: "long", year: "numeric" })}
          </h2>
          <button
            type="button"
            onClick={() => setMesAtual(new Date(ano, mes + 1, 1))}
            className="px-2 py-1.5 sm:px-3 rounded-lg border border-slate-600/40 text-xs sm:text-sm text-slate-400 hover:bg-slate-800/40 transition-colors"
          >
            <span className="hidden sm:inline">{new Date(ano, mes + 1, 1).toLocaleDateString("pt-PT", { month: "short" })}</span> →
          </button>
        </div>

        <div className="grid min-w-[280px] grid-cols-7 text-center">
          {["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"].map((d) => (
            <div
              key={d}
              className="py-1.5 sm:py-2 text-[9px] sm:text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-700/20"
            >
              <span className="sm:hidden">{d.charAt(0)}</span>
              <span className="hidden sm:inline">{d}</span>
            </div>
          ))}
          {dias.map((data, i) => (
            <button
              key={data ?? `blank-${i}`}
              type="button"
              disabled={!data}
              onClick={() => data && setSelectedDate(selectedDate === data ? null : data)}
              className={`min-h-[52px] sm:min-h-[72px] p-1 sm:p-1.5 border border-slate-700/10 text-left transition-colors ${
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
                    className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium ${
                      data === hoje ? "bg-blue-600 text-white" : "text-slate-400"
                    }`}
                  >
                    {dayFromDateKey(data)}
                  </span>
                  {temEventos(data) ? (
                    <div className="mt-1 space-y-0.5">
                      {eventosDoDia(data)
                        .slice(0, 3)
                        .map((e) => (
                          <div
                            key={e.id}
                            className="text-[9px] leading-tight truncate px-1 py-0.5 rounded bg-blue-500/15 text-blue-300"
                          >
                            {e.acaoCodigo} S{e.numeroSessao} {e.horaInicio}
                          </div>
                        ))}
                      {eventosDoDia(data).length > 3 ? (
                        <div className="text-[9px] text-slate-500 px-1">+{eventosDoDia(data).length - 3} mais</div>
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
        <div className="rounded-2xl bg-slate-900/50 border border-slate-700/30 p-5">
          <h3 className="text-sm font-semibold text-slate-200 mb-3">
            Sessoes de {formatDateKeyPt(selectedDate)}
          </h3>
          {eventosDoDia(selectedDate).length === 0 ? (
            <p className="text-sm text-slate-500">Sem sessoes neste dia.</p>
          ) : (
            <div className="space-y-2">
              {eventosDoDia(selectedDate).map((e) => (
                <div
                  key={e.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-800/40 border border-slate-700/20"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-200">
                      {e.acaoCodigo} – {e.acaoTitulo}
                    </p>
                    <p className="text-xs text-slate-500">
                      Sessao {e.numeroSessao} · {e.horaInicio}–{e.horaFim} · {e.modalidade} · [{e.estado}]
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${
                      e.estado === "CONCLUIDA"
                        ? "bg-green-500/10 text-green-400"
                        : e.estado === "EM_CURSO"
                          ? "bg-blue-500/10 text-blue-400"
                          : "bg-slate-500/10 text-slate-400"
                    }`}
                  >
                    {e.estado}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {loading ? <p className="text-sm text-slate-500 text-center py-4">A carregar calendario...</p> : null}
    </div>
  );
}
