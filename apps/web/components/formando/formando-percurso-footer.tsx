"use client";

import { ChevronDown } from "lucide-react";
import type { TarefaPercurso, UnidadePercurso } from "./formando-percurso-types";

type Props = {
  unidades: UnidadePercurso[];
  tarefas?: TarefaPercurso[];
  activeUnidadeId: string;
  busy?: boolean;
  onAvancar: () => void;
};

export function FormandoPercursoFooter({
  unidades,
  activeUnidadeId,
  busy,
  onAvancar,
}: Props) {
  const sorted = [...unidades].sort((a, b) => a.ordem - b.ordem);
  const idx = sorted.findIndex((u) => u.id === activeUnidadeId);
  const current = sorted[idx];
  const next = sorted.slice(idx + 1).find((u) => u.desbloqueado);

  if (!current) return null;

  if (!next) {
    const total = sorted.length;
    return (
      <div className="sticky bottom-0 z-10 border-t border-teal-500/30 bg-gradient-to-r from-blue-700/90 to-teal-700/90 px-4 py-4 pb-[max(1rem,var(--safe-bottom))] text-center text-white sm:px-6">
        <p className="text-sm font-semibold break-words">
          {idx + 1} de {total} - {current.titulo}
        </p>
        <p className="mt-1 text-xs opacity-90">Último módulo do percurso</p>
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={onAvancar}
      className="sticky bottom-0 z-10 flex w-full min-w-0 max-w-full flex-col items-center gap-1 border-t border-blue-500/30 bg-gradient-to-r from-blue-600 to-teal-600 px-4 py-4 pb-[max(1rem,var(--safe-bottom))] text-center text-white transition-all hover:from-blue-500 hover:to-teal-500 disabled:cursor-not-allowed disabled:opacity-60 sm:px-6"
    >
      <ChevronDown className="h-5 w-5 shrink-0 animate-bounce" />
      <span className="w-full max-w-full break-words text-sm font-bold uppercase tracking-wide">
        {idx + 2} de {sorted.length} - {next.titulo}
      </span>
      <span className="text-[11px] opacity-90">Concluir módulo e avançar</span>
    </button>
  );
}
