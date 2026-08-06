"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, UserX } from "lucide-react";
import { cn } from "@/lib/ui/cn";
import { formadorIniciais, formadorSubtitulo } from "@/lib/formador-display";

export type FormadorPickerOpt = {
  id: string;
  nomeCompleto: string;
  email?: string | null;
  ccpNumero?: string | null;
};

type Props = {
  formadores: FormadorPickerOpt[];
  value: string;
  disabled?: boolean;
  onChange: (formadorId: string | null) => void;
  /** Usado quando `value` existe mas ainda não está na lista (ex.: lista a carregar / 403). */
  fallbackLabel?: string | null;
};

export function FormadorSessaoPicker({
  formadores,
  value,
  disabled,
  onChange,
  fallbackLabel = null,
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = formadores.find((f) => f.id === value) ?? null;
  /** Mostra o nome da sessão mesmo se a lista API estiver vazia ou o value ainda não sincronizou. */
  const showFallback = !selected && !!fallbackLabel;

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative space-y-1">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        Formador da sessão
      </p>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition",
          "border-violet-500/35 bg-violet-950/40 hover:border-violet-400/50",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          open && "ring-1 ring-violet-400/40",
        )}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white">
          {selected
            ? formadorIniciais(selected.nomeCompleto)
            : showFallback
              ? formadorIniciais(fallbackLabel!)
              : "-"}
        </span>
        <span className="min-w-0 flex-1">
          {selected ? (
            <>
              <span className="block truncate text-sm font-semibold text-slate-100">
                {selected.nomeCompleto}
              </span>
              <span className="block truncate text-xs text-slate-400">
                {formadorSubtitulo(selected)}
              </span>
            </>
          ) : showFallback ? (
            <span className="block truncate text-sm font-semibold text-slate-100">
              {fallbackLabel}
            </span>
          ) : (
            <span className="block text-sm text-slate-400">Sem formador</span>
          )}
        </span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-slate-400 transition", open && "rotate-180")}
        />
      </button>

      {open ? (
        <div className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-700/60 bg-slate-900 shadow-xl">
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-red-300 hover:bg-red-950/40"
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
          >
            <UserX className="h-4 w-4" />
            Remover formador
          </button>
          {formadores.map((f) => {
            const active = f.id === value;
            return (
              <button
                key={f.id}
                type="button"
                className={cn(
                  "flex w-full items-center gap-3 px-3 py-2.5 text-left transition",
                  active ? "bg-violet-600/30" : "hover:bg-slate-800/80",
                )}
                onClick={() => {
                  onChange(f.id);
                  setOpen(false);
                }}
              >
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white",
                    active ? "bg-violet-600" : "bg-slate-600",
                  )}
                >
                  {formadorIniciais(f.nomeCompleto)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-100">
                    {f.nomeCompleto}
                  </span>
                  <span className="block truncate text-xs text-slate-400">
                    {formadorSubtitulo(f)}
                  </span>
                </span>
                {active ? <Check className="h-4 w-4 shrink-0 text-violet-200" /> : null}
              </button>
            );
          })}
          {formadores.length === 0 ? (
            <p className="px-3 py-3 text-xs text-slate-500">Sem formadores registados.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
