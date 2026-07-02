"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { bffFetch } from "@/lib/client/bff-fetch";
import {
  buildMonthGridCells,
  dayFromDateKey,
  formatDateKeyPt,
  formatLocalDateKey,
  isDateKeyInRange,
  monthLoadRange,
  toDateKey,
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

type CronogramaRow = {
  id: string;
  acaoFormacao: { codigoInterno: string; titulo: string };
};

type SessaoRow = {
  id: string;
  cronogramaId: string;
  numeroSessao: number;
  data: string;
  horaInicio: string;
  horaFim: string;
  modalidade: string;
  estado: string;
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
      const [crRes, sRes] = await Promise.all([
        bffFetch("/api/v1/cronogramas", { headers: { accept: "application/json" } }),
        bffFetch("/api/v1/sessoes-formacao", { headers: { accept: "application/json" } }),
      ]);

      if (!sRes.ok) {
        setError("Erro ao carregar sessões.");
        setEventos([]);
        return;
      }

      const acaoByCronograma = new Map<string, { codigoInterno: string; titulo: string }>();
      if (crRes.ok) {
        const cronos = (await crRes.json()) as CronogramaRow[];
        for (const c of cronos) {
          acaoByCronograma.set(c.id, c.acaoFormacao);
        }
      }

      const sessoes = (await sRes.json()) as SessaoRow[];
      const evts: SessaoEvent[] = [];
      for (const s of sessoes) {
        const dataKey = toDateKey(s.data);
        if (!isDateKeyInRange(dataKey, inicio, fim)) continue;
        const acao = acaoByCronograma.get(s.cronogramaId);
        evts.push({
          id: s.id,
          numeroSessao: s.numeroSessao,
          data: dataKey,
          horaInicio: s.horaInicio,
          horaFim: s.horaFim,
          modalidade: s.modalidade,
          estado: s.estado,
          acaoCodigo: acao?.codigoInterno ?? "-",
          acaoTitulo: acao?.titulo ?? "Formação",
        });
      }
      setEventos(evts);
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
        <p className="text-sm text-slate-500 mt-1">Visualizacao mensal das sessoes de formacao agendadas.</p>
      </div>

      {error ? (
        <div className="flex items-start gap-2.5 rounded-xl bg-red-950/40 border border-red-500/25 px-4 py-3">
          <p className="text-sm text-red-300">{error}</p>
        </div>
      ) : null}

      <div className="rounded-2xl bg-slate-900/50 border border-slate-700/30 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/30">
          <button
            type="button"
            onClick={() => setMesAtual(new Date(ano, mes - 1, 1))}
            className="px-3 py-1.5 rounded-lg border border-slate-600/40 text-sm text-slate-400 hover:bg-slate-800/40 transition-colors"
          >
            ← {new Date(ano, mes - 1, 1).toLocaleDateString("pt-PT", { month: "short" })}
          </button>
          <h2 className="text-lg font-bold text-slate-100">
            {new Date(ano, mes, 1).toLocaleDateString("pt-PT", { month: "long", year: "numeric" })}
          </h2>
          <button
            type="button"
            onClick={() => setMesAtual(new Date(ano, mes + 1, 1))}
            className="px-3 py-1.5 rounded-lg border border-slate-600/40 text-sm text-slate-400 hover:bg-slate-800/40 transition-colors"
          >
            {new Date(ano, mes + 1, 1).toLocaleDateString("pt-PT", { month: "short" })} →
          </button>
        </div>

        <div className="grid grid-cols-7 text-center">
          {["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"].map((d) => (
            <div
              key={d}
              className="py-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-700/20"
            >
              {d}
            </div>
          ))}
          {dias.map((data, i) => (
            <button
              key={data ?? `blank-${i}`}
              type="button"
              disabled={!data}
              onClick={() => data && setSelectedDate(selectedDate === data ? null : data)}
              className={`min-h-[72px] p-1.5 border border-slate-700/10 text-left transition-colors ${
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
