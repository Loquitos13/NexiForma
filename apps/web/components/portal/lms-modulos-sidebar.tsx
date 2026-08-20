"use client";

import { BookMarked, Plus } from "lucide-react";
import { UNIDADE_FLAT_ID } from "@/components/formando/formando-percurso-types";
import {
  globalPubStats,
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
  onSelectUnidade: (id: string) => void;
  onCreateUnidade: () => void;
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
  onSelectUnidade,
  onCreateUnidade,
}: Props) {
  const horasDistribuidas = totalHorasUnidades(unidades);
  const horasRestantes = Math.max(0, cursoCargaHoras - horasDistribuidas);
  const pctCarga = cursoCargaHoras > 0 ? Math.min(100, (horasDistribuidas / cursoCargaHoras) * 100) : 0;
  const globalPub = globalPubStats(modulos);

  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-slate-700/30 bg-slate-950/60 lg:w-64 lg:border-b-0 lg:border-r">
      <div className="space-y-4 p-4">
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

        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
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

          <div className="space-y-1.5 max-h-[280px] overflow-y-auto">
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

            {unidades.map((u) => {
              const active = selectedUnidadeId === u.id;
              const stats = pubStats(modulos, u.id);
              const horas = u.cargaHoras ?? (u.cargaHorasTeoricas ?? 0) + (u.cargaHorasPraticas ?? 0);
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => onSelectUnidade(u.id)}
                  className={`w-full rounded-xl border px-3 py-2.5 text-left transition-colors ${
                    active
                      ? "border-teal-500/40 bg-teal-500/10 ring-1 ring-teal-500/20"
                      : "border-slate-700/30 bg-slate-900/40 hover:border-slate-600/40"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <BookMarked className={`h-4 w-4 shrink-0 mt-0.5 ${active ? "text-teal-400" : "text-slate-500"}`} />
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
                    </div>
                  </div>
                </button>
              );
            })}

            {unidades.length === 0 && flatCount === 0 ? (
              <p className="py-4 text-center text-xs text-slate-500">Cria o primeiro módulo.</p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-auto border-t border-slate-700/30 p-4">
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
