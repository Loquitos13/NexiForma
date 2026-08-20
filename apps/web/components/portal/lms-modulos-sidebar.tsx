"use client";

import { BookMarked, GripVertical, Plus } from "lucide-react";
import { UNIDADE_FLAT_ID } from "@/components/formando/formando-percurso-types";
import {
  globalPubStats,
  metodologiaLabel,
  pubStats,
  totalHorasUnidades,
  type ModuloNode,
  type UnidadeNode,
} from "@/components/portal/lms-modulos-shared";

type Props = {
  cursoCargaHoras: number;
  progressaoSequencial: boolean;
  onProgressaoChange: (sequencial: boolean) => void;
  unidades: UnidadeNode[];
  modulos: ModuloNode[];
  flatCount: number;
  selectedUnidadeId: string | null;
  canEdit: boolean;
  busy: boolean;
  unidadeDropIdx: number | null;
  onSelectUnidade: (id: string) => void;
  onCreateUnidade: () => void;
  onUnidadeDragStart: (idx: number) => void;
  onUnidadeDragEnd: () => void;
  onUnidadeDragOver: (idx: number) => void;
  onUnidadeDrop: (idx: number) => void;
};

export function LmsModulosSidebar({
  cursoCargaHoras,
  progressaoSequencial,
  onProgressaoChange,
  unidades,
  modulos,
  flatCount,
  selectedUnidadeId,
  canEdit,
  busy,
  unidadeDropIdx,
  onSelectUnidade,
  onCreateUnidade,
  onUnidadeDragStart,
  onUnidadeDragEnd,
  onUnidadeDragOver,
  onUnidadeDrop,
}: Props) {
  const horasDistribuidas = totalHorasUnidades(unidades);
  const horasRestantes = Math.max(0, cursoCargaHoras - horasDistribuidas);
  const pctCarga = cursoCargaHoras > 0 ? Math.min(100, (horasDistribuidas / cursoCargaHoras) * 100) : 0;
  const globalPub = globalPubStats(modulos);

  return (
    <aside className="flex h-full min-h-0 w-full shrink-0 flex-col border-b border-slate-700/30 bg-slate-950/60 lg:w-64 lg:border-b-0 lg:border-r">
      <div className="shrink-0 space-y-4 p-4 pb-0">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Carga horária total</p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
            <div className="h-full rounded-full bg-teal-500 transition-all" style={{ width: `${pctCarga}%` }} />
          </div>
          <p className="mt-1.5 text-xs text-slate-300 tabular-nums">
            {horasDistribuidas}h / {cursoCargaHoras}h
          </p>
          <p className="text-[10px] text-slate-500">{horasRestantes}h por distribuir</p>
        </div>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Progressão</p>
          <div className="flex rounded-lg border border-slate-700/40 p-0.5">
            <button
              type="button"
              disabled={!canEdit || busy}
              onClick={() => onProgressaoChange(false)}
              className={`flex-1 rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors ${
                !progressaoSequencial ? "bg-slate-700 text-slate-100" : "text-slate-500 hover:text-slate-300"
              }`}
            >
              Livre
            </button>
            <button
              type="button"
              disabled={!canEdit || busy}
              onClick={() => onProgressaoChange(true)}
              className={`flex-1 rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors ${
                progressaoSequencial ? "bg-teal-600/30 text-teal-300" : "text-slate-500 hover:text-slate-300"
              }`}
            >
              Sequencial
            </button>
          </div>
          <p className="mt-1.5 text-[10px] text-slate-600 leading-snug">
            {progressaoSequencial
              ? "Cada módulo requer a conclusão do anterior"
              : "Formandos acedem a todos os módulos visíveis"}
          </p>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-4 pt-4 pb-2">
        <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Módulos</p>
          {canEdit ? (
            <button
              type="button"
              title="Novo módulo"
              disabled={busy}
              onClick={onCreateUnidade}
              data-guided-flow-anchor="lms-novo-modulo"
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-600/20 text-teal-400 hover:bg-teal-600/30"
            >
              <Plus className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        {canEdit && unidades.length > 1 ? (
          <p className="mb-2 shrink-0 text-[10px] text-slate-600">Arrasta para reordenar</p>
        ) : null}

        <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto">
            {flatCount > 0 ? (
              <button
                type="button"
                onClick={() => onSelectUnidade(UNIDADE_FLAT_ID)}
                className={`w-full rounded-xl border px-3 py-2.5 text-left transition-colors ${
                  selectedUnidadeId === UNIDADE_FLAT_ID
                    ? "border-blue-500/40 bg-blue-500/10 ring-1 ring-blue-500/20"
                    : "border-slate-700/30 bg-slate-900/40 hover:border-slate-600/40"
                }`}
              >
                <p className="text-xs font-semibold text-slate-100">Percurso directo</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{flatCount} conteúdo(s)</p>
              </button>
            ) : null}

            {unidades.map((u, idx) => {
              const active = selectedUnidadeId === u.id;
              const stats = pubStats(modulos, u.id);
              const horas = u.cargaHoras ?? (u.cargaHorasTeoricas ?? 0) + (u.cargaHorasPraticas ?? 0);
              return (
                <div
                  key={u.id}
                  draggable={canEdit && !busy}
                  onDragStart={() => canEdit && onUnidadeDragStart(idx)}
                  onDragEnd={onUnidadeDragEnd}
                  onDragOver={(e) => {
                    e.preventDefault();
                    onUnidadeDragOver(idx);
                  }}
                  onDrop={() => onUnidadeDrop(idx)}
                  className={`flex items-stretch gap-0.5 rounded-xl border transition-all ${
                    unidadeDropIdx === idx
                      ? "border-teal-500/60 ring-2 ring-teal-500/20"
                      : active
                        ? "border-teal-500/40 bg-teal-500/10 ring-1 ring-teal-500/20"
                        : "border-slate-700/30 bg-slate-900/40"
                  }`}
                >
                  {canEdit ? (
                    <div
                      className="flex shrink-0 cursor-grab items-center px-1 text-slate-600 active:cursor-grabbing"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <GripVertical className="h-4 w-4" />
                    </div>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => onSelectUnidade(u.id)}
                    className="min-w-0 flex-1 px-2 py-2.5 text-left transition-colors hover:bg-slate-800/30 rounded-r-xl"
                  >
                    <div className="flex items-start gap-2">
                      <BookMarked
                        className={`h-4 w-4 shrink-0 mt-0.5 ${active ? "text-teal-400" : "text-slate-500"}`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-slate-100 line-clamp-2">{u.titulo}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          {horas > 0 ? `${horas}h` : "--h"} · {stats.total} conteúdo(s)
                        </p>
                        <p className="text-[10px] mt-0.5">
                          <span className={u.visivel !== false ? "text-teal-500/80" : "text-slate-600"}>
                            {u.visivel !== false ? "Visível" : "Oculto"}
                          </span>
                          {stats.total > 0 ? (
                            <span className="text-slate-600"> · {stats.pub}/{stats.total} pub.</span>
                          ) : null}
                        </p>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          <span className="rounded border border-violet-500/25 bg-violet-500/10 px-1.5 py-0.5 text-[9px] font-medium text-violet-300">
                            {metodologiaLabel(u.metodologia ?? null)}
                          </span>
                          <span
                            className={`rounded border px-1.5 py-0.5 text-[9px] font-medium ${
                              u.obrigatorio !== false
                                ? "border-amber-500/25 bg-amber-500/10 text-amber-300"
                                : "border-slate-600/40 bg-slate-800/60 text-slate-500"
                            }`}
                          >
                            {u.obrigatorio !== false ? "Obrigatório" : "Opcional"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                </div>
              );
            })}

            {unidades.length === 0 && flatCount === 0 ? (
              <p className="py-4 text-center text-xs text-slate-500">Cria o primeiro módulo.</p>
            ) : null}
        </div>
      </div>

      <div className="shrink-0 border-t border-slate-700/30 p-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Publicados</p>
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-green-500/80"
            style={{ width: globalPub.total ? `${(globalPub.pub / globalPub.total) * 100}%` : "0%" }}
          />
        </div>
        <p className="mt-1 text-[10px] text-slate-500 tabular-nums">
          {globalPub.pub}/{globalPub.total}
        </p>
      </div>
    </aside>
  );
}
