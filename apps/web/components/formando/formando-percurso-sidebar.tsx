"use client";

import { Check, Circle, Lock } from "lucide-react";
import { cn } from "@/lib/ui/cn";
import type { TarefaPercurso, UnidadePercurso } from "./formando-percurso-types";
import { tarefasDaUnidade } from "./formando-percurso-types";

type Props = {
  tituloCurso: string;
  progressoPct: number;
  unidades: UnidadePercurso[];
  tarefas: TarefaPercurso[];
  activeUnidadeId: string;
  activeTarefaId?: string | null;
  onSelectUnidade: (id: string) => void;
  onSelectTarefa: (unidadeId: string, tarefaId: string) => void;
  collapsed?: boolean;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  onToggleCollapse?: () => void;
};

function unidadeConcluida(tarefas: TarefaPercurso[], unidadeId: string): boolean {
  const items = tarefasDaUnidade(tarefas, unidadeId);
  return items.length > 0 && items.every((t) => t.concluido);
}

export function FormandoPercursoSidebar({
  tituloCurso,
  progressoPct,
  unidades,
  tarefas,
  activeUnidadeId,
  activeTarefaId,
  onSelectUnidade,
  onSelectTarefa,
  collapsed,
  mobileOpen,
  onMobileClose,
  onToggleCollapse,
}: Props) {
  const sorted = [...unidades].sort((a, b) => a.ordem - b.ordem);

  const selectUnidade = (id: string) => {
    onSelectUnidade(id);
    onMobileClose?.();
  };

  const selectTarefa = (unidadeId: string, tarefaId: string) => {
    onSelectTarefa(unidadeId, tarefaId);
    onMobileClose?.();
  };

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          aria-label="Fechar menu do curso"
          onClick={onMobileClose}
        />
      ) : null}
      <aside
        className={cn(
          "portal-fixed-drawer flex h-full flex-col border-r border-slate-700/40 bg-slate-950/95 text-slate-200 transition-all duration-300",
          collapsed ? "w-16" : "w-[min(92vw,22rem)] lg:w-96",
          "lg:flex-shrink-0",
          mobileOpen ? "translate-x-0" : "max-lg:-translate-x-full",
          !mobileOpen && "max-lg:hidden lg:flex",
        )}
      >
        <div className="bg-gradient-to-br from-blue-600/90 via-blue-700/80 to-teal-600/70 px-5 py-6 text-white">
          {!collapsed ? (
            <>
              <p className="text-xs font-semibold uppercase tracking-wider opacity-90">Formação</p>
              <h2 className="mt-1.5 text-xl font-bold leading-snug line-clamp-3">{tituloCurso}</h2>
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span>{progressoPct}% completo</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/25">
                  <div
                    className="h-full rounded-full bg-teal-300 transition-all duration-500"
                    style={{ width: `${progressoPct}%` }}
                  />
                </div>
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="mx-auto flex h-9 w-9 items-center justify-center rounded-lg bg-white/15"
              aria-label="Expandir menu"
            >
              <span className="text-xs font-bold">{progressoPct}%</span>
            </button>
          )}
        </div>

        {!collapsed ? (
          <nav className="flex-1 overflow-y-auto py-3" aria-label="Módulos e tópicos">
            <ul className="space-y-1">
              {sorted.map((unidade) => {
                const items = tarefasDaUnidade(tarefas, unidade.id);
                const active = unidade.id === activeUnidadeId;
                const done = unidadeConcluida(tarefas, unidade.id);
                const locked = !unidade.desbloqueado;

                return (
                  <li key={unidade.id}>
                    <button
                      type="button"
                      disabled={locked}
                      onClick={() => selectUnidade(unidade.id)}
                      className={cn(
                        "flex w-full items-center gap-2.5 px-5 py-3.5 text-left text-sm font-semibold uppercase tracking-wide transition-colors",
                        active
                          ? "border-l-4 border-blue-400 bg-slate-800/80 text-blue-200"
                          : "border-l-4 border-transparent text-slate-400 hover:bg-slate-800/50 hover:text-slate-200",
                        locked && "cursor-not-allowed opacity-50",
                      )}
                    >
                      <span className="min-w-0 flex-1 truncate">{unidade.titulo}</span>
                      {locked ? (
                        <Lock className="h-4 w-4 shrink-0 text-slate-500" />
                      ) : done ? (
                        <Check className="h-4 w-4 shrink-0 text-teal-400" strokeWidth={3} />
                      ) : active ? (
                        <span className="h-4 w-4 shrink-0 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
                      ) : (
                        <Circle className="h-4 w-4 shrink-0 text-slate-600" />
                      )}
                    </button>

                    {active && items.length > 0 ? (
                      <ul className="mb-2 ml-7 mr-3 space-y-0.5 border-l-2 border-blue-500/25">
                        {items.map((t) => {
                          const tActive = t.id === activeTarefaId;
                          const tLocked = !t.desbloqueado;
                          return (
                            <li key={t.id}>
                              <button
                                type="button"
                                disabled={tLocked}
                                onClick={() => selectTarefa(unidade.id, t.id)}
                                className={cn(
                                  "flex w-full items-center gap-2 rounded-r-lg py-2.5 pl-4 pr-2 text-left text-sm transition-colors",
                                  tActive
                                    ? "bg-blue-500/15 font-medium text-blue-300"
                                    : "text-slate-500 hover:bg-slate-800/60 hover:text-slate-300",
                                  tLocked && "opacity-40",
                                )}
                              >
                                <span className="min-w-0 flex-1 truncate normal-case">{t.titulo}</span>
                                {t.concluido ? (
                                  <Check className="h-3.5 w-3.5 shrink-0 text-teal-400" strokeWidth={3} />
                                ) : (
                                  <Circle className="h-3 w-3 shrink-0 text-slate-600" />
                                )}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </nav>
        ) : null}
      </aside>
    </>
  );
}
