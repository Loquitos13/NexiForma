"use client";

import { useState } from "react";
import { Eye, EyeOff, Pencil, Star, Trash2, X } from "lucide-react";
import {
  INPUT_CLASS,
  METODOLOGIA_OPTS,
  type MetodologiaModulo,
  type UnidadeNode,
} from "@/components/portal/lms-modulos-shared";

type Props = {
  unidade: UnidadeNode;
  unidades: UnidadeNode[];
  canEdit: boolean;
  busy: boolean;
  onUpdate: (patch: Partial<UnidadeNode>) => void;
  onDelete: () => void;
};

export function LmsModuloHeader({ unidade, unidades, canEdit, busy, onUpdate, onDelete }: Props) {
  const [renaming, setRenaming] = useState(false);
  const [draftTitulo, setDraftTitulo] = useState(unidade.titulo);

  const teoricas = unidade.cargaHorasTeoricas ?? 0;
  const praticas = unidade.cargaHorasPraticas ?? 0;
  const total = (unidade.cargaHoras ?? teoricas + praticas) || teoricas + praticas;

  const prereqOpts = unidades.filter((u) => u.id !== unidade.id && u.ordem < unidade.ordem);

  function commitRename() {
    const t = draftTitulo.trim();
    if (t && t !== unidade.titulo) onUpdate({ titulo: t });
    setRenaming(false);
  }

  return (
    <div className="shrink-0 space-y-4 border-b border-slate-700/30 bg-slate-900/30 p-4">
      <div className="flex flex-wrap items-center gap-2">
        {renaming ? (
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <input
              className={`${INPUT_CLASS} max-w-md text-sm font-semibold`}
              value={draftTitulo}
              autoFocus
              disabled={!canEdit || busy}
              onChange={(e) => setDraftTitulo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename();
                if (e.key === "Escape") {
                  setDraftTitulo(unidade.titulo);
                  setRenaming(false);
                }
              }}
              onBlur={commitRename}
            />
          </div>
        ) : (
          <h2 className="min-w-0 flex-1 text-base font-semibold text-slate-100 truncate">{unidade.titulo}</h2>
        )}

        {canEdit ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {!renaming ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setDraftTitulo(unidade.titulo);
                  setRenaming(true);
                }}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-700/50 px-2.5 py-1.5 text-[11px] text-slate-300 hover:bg-slate-800/60"
              >
                <Pencil className="h-3 w-3" /> Renomear
              </button>
            ) : null}

            <button
              type="button"
              disabled={busy}
              onClick={() => onUpdate({ visivel: !(unidade.visivel !== false) })}
              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium ${
                unidade.visivel !== false
                  ? "border-teal-500/40 bg-teal-500/10 text-teal-300"
                  : "border-slate-700/50 text-slate-500"
              }`}
            >
              {unidade.visivel !== false ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
              {unidade.visivel !== false ? "Visível" : "Oculto"}
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={() => onUpdate({ obrigatorio: !(unidade.obrigatorio !== false) })}
              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium ${
                unidade.obrigatorio !== false
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                  : "border-slate-700/50 text-slate-500"
              }`}
            >
              <Star className="h-3 w-3" />
              {unidade.obrigatorio !== false ? "Obrigatório" : "Opcional"}
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={onDelete}
              className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 px-2.5 py-1.5 text-[11px] text-red-400 hover:bg-red-950/40"
            >
              <Trash2 className="h-3 w-3" /> Apagar módulo
            </button>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-wrap gap-3">
          <label className="block w-20">
            <span className="text-[10px] uppercase tracking-wide text-slate-500">Teóricas</span>
            <input
              type="number"
              min={0}
              disabled={!canEdit || busy}
              className={`${INPUT_CLASS} mt-1 h-9 tabular-nums`}
              value={unidade.cargaHorasTeoricas ?? ""}
              onChange={(e) =>
                onUpdate({
                  cargaHorasTeoricas: e.target.value === "" ? null : Number(e.target.value) || 0,
                })
              }
            />
          </label>
          <label className="block w-20">
            <span className="text-[10px] uppercase tracking-wide text-slate-500">Práticas</span>
            <input
              type="number"
              min={0}
              disabled={!canEdit || busy}
              className={`${INPUT_CLASS} mt-1 h-9 tabular-nums`}
              value={unidade.cargaHorasPraticas ?? ""}
              onChange={(e) =>
                onUpdate({
                  cargaHorasPraticas: e.target.value === "" ? null : Number(e.target.value) || 0,
                })
              }
            />
          </label>
          <div className="rounded-lg border border-teal-500/30 bg-teal-500/10 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-teal-500/80">Total módulo</p>
            <p className="text-sm font-bold text-teal-300 tabular-nums">{total > 0 ? `${total}h` : "--h"}</p>
          </div>
        </div>

        <label className="block min-w-[140px]">
          <span className="text-[10px] uppercase tracking-wide text-slate-500">Pré-requisito</span>
          <select
            disabled={!canEdit || busy}
            className={`${INPUT_CLASS} mt-1 h-9`}
            value={unidade.prerequisitoUnidadeId ?? ""}
            onChange={(e) => onUpdate({ prerequisitoUnidadeId: e.target.value || null })}
          >
            <option value="">Nenhum</option>
            {prereqOpts.map((u) => (
              <option key={u.id} value={u.id}>
                {u.titulo}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-1.5">Metodologia</p>
        <div className="inline-flex rounded-lg border border-slate-700/40 p-0.5">
          {METODOLOGIA_OPTS.map((m) => {
            const active = (unidade.metodologia ?? null) === m.id;
            return (
              <button
                key={m.id}
                type="button"
                disabled={!canEdit || busy}
                onClick={() => onUpdate({ metodologia: m.id as MetodologiaModulo })}
                className={`rounded-md px-3 py-1.5 text-[11px] font-medium transition-colors ${
                  active ? "bg-violet-600/30 text-violet-200" : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {m.label}
              </button>
            );
          })}
          {unidade.metodologia ? (
            <button
              type="button"
              disabled={!canEdit || busy}
              title="Herda do curso"
              onClick={() => onUpdate({ metodologia: null })}
              className="rounded-md px-2 py-1.5 text-slate-600 hover:text-slate-400"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : (
            <span className="self-center px-2 text-[10px] text-slate-600">(curso)</span>
          )}
        </div>
      </div>
    </div>
  );
}
