"use client";

import { CheckCircle2, ChevronDown, LogOut } from "lucide-react";
import { tarefaConcluidaEfectiva } from "@nexiforma/shared";
import type { TarefaPercurso, UnidadePercurso } from "./formando-percurso-types";
import { tarefasDaUnidade } from "./formando-percurso-types";

type Props = {
  unidades: UnidadePercurso[];
  tarefas: TarefaPercurso[];
  activeUnidadeId: string;
  busy?: boolean;
  onAvancar: () => void;
  /** Último módulo concluído → sair da vista de conteúdos. */
  onSair: () => void;
};

function podeAvancarModulo(
  unidade: UnidadePercurso | undefined,
  tarefas: TarefaPercurso[],
): { ok: boolean; motivo: string | null } {
  if (!unidade) return { ok: false, motivo: null };
  const allItems = tarefasDaUnidade(tarefas, unidade.id);
  const items = allItems.filter((t) => t.desbloqueado);

  if (allItems.length === 0 || items.length === 0) {
    return { ok: true, motivo: null };
  }

  const pendentes = items.filter((t) => !tarefaConcluidaEfectiva(t));
  if (pendentes.length > 0) {
    return {
      ok: false,
      motivo: `Conclui ${pendentes.length} conteúdo(s) deste módulo antes de avançar.`,
    };
  }
  const minima = unidade.notaMinima;
  if (minima != null && minima > 0) {
    const score = unidade.pontuacao;
    if (score == null || score < minima) {
      return {
        ok: false,
        motivo: `Precisas de pelo menos ${minima}% neste módulo (actual: ${score ?? 0}%).`,
      };
    }
  }
  for (const t of items) {
    if (t.notaMinima != null && t.notaMinima > 0) {
      const s = t.pontuacao ?? (tarefaConcluidaEfectiva(t) ? 100 : null);
      if (s == null || s < t.notaMinima) {
        return {
          ok: false,
          motivo: `«${t.titulo}» exige nota mínima de ${t.notaMinima}%.`,
        };
      }
    }
  }
  return { ok: true, motivo: null };
}

export function FormandoPercursoFooter({
  unidades,
  tarefas,
  activeUnidadeId,
  busy,
  onAvancar,
  onSair,
}: Props) {
  const sorted = [...unidades].sort((a, b) => a.ordem - b.ordem);
  const idx = sorted.findIndex((u) => u.id === activeUnidadeId);
  const current = sorted[idx];
  const next = sorted.slice(idx + 1).find((u) => u.desbloqueado);
  const gate = podeAvancarModulo(current, tarefas);

  if (!current || !gate.ok) return null;

  if (!next) {
    const total = sorted.length;
    const enabled = !busy;
    return (
      <button
        type="button"
        disabled={!enabled}
        onClick={onSair}
        className="shrink-0 z-10 flex w-full min-w-0 max-w-full flex-col items-center gap-1 border-t border-teal-500/30 bg-gradient-to-r from-blue-700 to-teal-700 px-4 py-3 pb-[max(0.75rem,var(--safe-bottom))] text-center text-white transition-all hover:from-blue-600 hover:to-teal-600 disabled:cursor-not-allowed disabled:opacity-70 sm:px-6 sm:py-4"
      >
        <CheckCircle2 className="h-5 w-5 shrink-0" />
        <span className="w-full max-w-full break-words text-sm font-bold uppercase tracking-wide">
          {idx + 1} de {total} - {current.titulo}
        </span>
        <span className="inline-flex items-center gap-1.5 text-[11px] opacity-90">
          <LogOut className="h-3.5 w-3.5" />
          Concluir e sair dos conteúdos
        </span>
      </button>
    );
  }

  const enabled = !busy;

  return (
    <button
      type="button"
      disabled={!enabled}
      onClick={onAvancar}
      className="shrink-0 z-10 flex w-full min-w-0 max-w-full flex-col items-center gap-1 border-t border-blue-500/30 bg-gradient-to-r from-blue-600 to-teal-600 px-4 py-3 pb-[max(0.75rem,var(--safe-bottom))] text-center text-white transition-all hover:from-blue-500 hover:to-teal-500 disabled:cursor-not-allowed disabled:opacity-70 sm:px-6 sm:py-4"
    >
      <ChevronDown className="h-5 w-5 shrink-0 animate-bounce" />
      <span className="w-full max-w-full break-words text-sm font-bold uppercase tracking-wide">
        {idx + 2} de {sorted.length} - {next.titulo}
      </span>
      <span className="text-[11px] opacity-90">Avançar para o módulo seguinte</span>
    </button>
  );
}
