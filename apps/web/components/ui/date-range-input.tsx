"use client";

import { useEffect, useRef, useState } from "react";
import { Calendar, X } from "lucide-react";
import { cn } from "@/lib/ui/cn";
import {
  buildMonthGridCells,
  dayFromDateKey,
  formatDateKeyPt,
  isDateKeyInRange,
} from "@/lib/calendar-date";

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

type Props = {
  label?: string;
  dataInicio: string;
  dataFim: string;
  onChange: (dataInicio: string, dataFim: string) => void;
  className?: string;
};

function formatRangeLabel(inicio: string, fim: string, picking: string | null): string {
  if (picking) return `${formatDateKeyPt(picking)} – …`;
  if (inicio && fim) return `${formatDateKeyPt(inicio)} – ${formatDateKeyPt(fim)}`;
  if (inicio) return `Desde ${formatDateKeyPt(inicio)}`;
  if (fim) return `Até ${formatDateKeyPt(fim)}`;
  return "";
}

export function DateRangeInput({
  label = "Período",
  dataInicio,
  dataFim,
  onChange,
  className,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [draftStart, setDraftStart] = useState<string | null>(null);
  const [mesAtual, setMesAtual] = useState(() => {
    const seed = dataInicio || dataFim;
    return seed ? new Date(`${seed}T12:00:00`) : new Date();
  });

  const ano = mesAtual.getFullYear();
  const mes = mesAtual.getMonth();
  const dias = buildMonthGridCells(ano, mes);

  const previewStart = draftStart ?? dataInicio;
  const previewEnd = draftStart ? null : dataFim;
  const hasValue = Boolean(dataInicio || dataFim);
  const display = formatRangeLabel(dataInicio, dataFim, draftStart);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setDraftStart(null);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  function openPicker() {
    const seed = dataInicio || dataFim;
    if (seed) setMesAtual(new Date(`${seed}T12:00:00`));
    setDraftStart(null);
    setOpen(true);
  }

  function pickDay(key: string) {
    if (!draftStart) {
      setDraftStart(key);
      return;
    }
    const [inicio, fim] = draftStart <= key ? [draftStart, key] : [key, draftStart];
    onChange(inicio, fim);
    setDraftStart(null);
    setOpen(false);
  }

  function clear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange("", "");
    setDraftStart(null);
    setOpen(false);
  }

  function dayState(key: string) {
    if (!previewStart) return "none" as const;
    const end = previewEnd ?? previewStart;
    const inicio = previewStart <= end ? previewStart : end;
    const fim = previewStart <= end ? end : previewStart;
    if (key === inicio && key === fim) return "single" as const;
    if (key === inicio) return "start" as const;
    if (key === fim) return "end" as const;
    if (isDateKeyInRange(key, inicio, fim)) return "middle" as const;
    return "none" as const;
  }

  return (
    <div ref={rootRef} className={cn("relative flex flex-col gap-1.5", className)}>
      {label ? <span className="text-sm font-medium text-slate-300">{label}</span> : null}
      <button
        type="button"
        onClick={openPicker}
        className={cn(
          "flex h-9 w-full min-w-[220px] items-center gap-2 rounded-lg border border-slate-600/60 bg-slate-900/80 px-3 text-sm",
          "text-left transition-colors hover:border-slate-500/70 focus:outline-none focus:ring-2 focus:ring-blue-500/60",
          hasValue ? "text-slate-100" : "text-slate-500",
        )}
      >
        <Calendar className="h-4 w-4 shrink-0 text-slate-500" />
        <span className="min-w-0 flex-1 truncate">{display || "Selecionar período"}</span>
        {hasValue ? (
          <span
            role="button"
            tabIndex={0}
            onClick={clear}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") clear(e as unknown as React.MouseEvent);
            }}
            className="rounded p-0.5 text-slate-500 hover:bg-slate-800 hover:text-slate-200"
            aria-label="Limpar período"
          >
            <X className="h-3.5 w-3.5" />
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute left-0 top-full z-50 mt-1 w-[280px] rounded-xl border border-slate-700/60 bg-slate-900 p-3 shadow-xl">
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setMesAtual(new Date(ano, mes - 1, 1))}
              className="rounded-lg px-2 py-1 text-sm text-slate-400 hover:bg-slate-800"
              aria-label="Mês anterior"
            >
              ←
            </button>
            <span className="text-sm font-medium text-slate-200">
              {MESES[mes]} {ano}
            </span>
            <button
              type="button"
              onClick={() => setMesAtual(new Date(ano, mes + 1, 1))}
              className="rounded-lg px-2 py-1 text-sm text-slate-400 hover:bg-slate-800"
              aria-label="Mês seguinte"
            >
              →
            </button>
          </div>

          <div className="grid grid-cols-7 gap-y-0.5 text-center">
            {DIAS.map((d) => (
              <div key={d} className="py-1 text-[10px] font-medium uppercase text-slate-500">
                {d}
              </div>
            ))}
            {dias.map((key, i) => {
              if (!key) {
                return <div key={`blank-${i}`} />;
              }
              const state = dayState(key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => pickDay(key)}
                  className={cn(
                    "relative mx-auto flex h-8 w-full max-w-[34px] items-center justify-center text-sm transition-colors",
                    state === "none" && "rounded-lg text-slate-300 hover:bg-slate-800",
                    state === "middle" && "bg-blue-500/15 text-slate-100",
                    state === "start" && "rounded-l-lg bg-blue-600 text-white",
                    state === "end" && "rounded-r-lg bg-blue-600 text-white",
                    state === "single" && "rounded-lg bg-blue-600 text-white",
                  )}
                >
                  {dayFromDateKey(key)}
                </button>
              );
            })}
          </div>

          <p className="mt-3 text-center text-[11px] text-slate-500">
            {draftStart ? "Seleccione a data final" : "Seleccione a data inicial"}
          </p>
        </div>
      ) : null}
    </div>
  );
}
