"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";

type Props = {
  visible: boolean;
  tituloAtual: string;
  tituloProximo?: string;
  onDone: () => void;
};

export function FormandoModuloTransition({ visible, tituloAtual, tituloProximo, onDone }: Props) {
  const [phase, setPhase] = useState<"enter" | "hold" | "exit">("enter");

  useEffect(() => {
    if (!visible) return;
    setPhase("enter");
    const hold = setTimeout(() => setPhase("hold"), 300);
    const exit = setTimeout(() => setPhase("exit"), 1400);
    const done = setTimeout(() => onDone(), 1900);
    return () => {
      clearTimeout(hold);
      clearTimeout(exit);
      clearTimeout(done);
    };
  }, [visible, onDone]);

  if (!visible) return null;

  return (
    <div
      className={`pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-[#070b12]/85 backdrop-blur-sm transition-opacity duration-500 ${
        phase === "exit" ? "opacity-0" : "opacity-100"
      }`}
      aria-live="polite"
    >
      <div
        className={`mx-4 max-w-md rounded-2xl border border-teal-500/30 bg-slate-900/95 px-8 py-10 text-center shadow-2xl transition-all duration-500 ${
          phase === "enter" ? "scale-90 opacity-0" : phase === "exit" ? "scale-105 opacity-0" : "scale-100 opacity-100"
        }`}
      >
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-teal-500/20">
          <Check className="h-8 w-8 text-teal-400" strokeWidth={3} />
        </div>
        <p className="text-xs font-semibold uppercase tracking-widest text-teal-400/80">Módulo concluído</p>
        <h3 className="mt-2 text-lg font-bold text-slate-100">{tituloAtual}</h3>
        {tituloProximo ? (
          <p className="mt-4 text-sm text-slate-400">
            A seguir: <span className="font-medium text-blue-300">{tituloProximo}</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}
