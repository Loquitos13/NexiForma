"use client";

import { useRef, type DragEvent } from "react";
import {
  GripVertical,
  Plus,
  Upload,
  X,
} from "lucide-react";
import { isModuloStorageRef } from "@nexiforma/shared";
import { ModuloStoredMedia } from "@/components/lms/ModuloStoredMedia";
import { QuizPerguntaEditor } from "@/components/portal/QuizPerguntaEditor";
import {
  INPUT_CLASS,
  TIPOS_CONTEUDO,
  colorMap,
  conteudoSubtitle,
  fileMeta,
  formatBytes,
  tipoMeta,
  type ModuloNode,
} from "@/components/portal/lms-modulos-shared";
import { Button } from "@/components/ui";

type Props = {
  conteudos: ModuloNode[];
  expandedId: string | null;
  canEdit: boolean;
  busy: boolean;
  dragOverUpload: boolean;
  dropIdx: number | null;
  onExpand: (id: string | null) => void;
  onDragStart: (idx: number) => void;
  onDragEnd: () => void;
  onDragOver: (idx: number) => void;
  onDrop: (idx: number) => void;
  onAdd: (tipo: ModuloNode["tipo"]) => void;
  onUpdate: (id: string, patch: Partial<ModuloNode>) => void;
  onDelete: (id: string) => void;
  onUploadDrop: (e: DragEvent) => void;
  onUploadFiles: () => void;
  onFileUpload: (file: File, moduloId: string) => void;
  setDragOverUpload: (v: boolean) => void;
  uploadAccept: string;
};

export function LmsConteudoList({
  conteudos,
  expandedId,
  canEdit,
  busy,
  dragOverUpload,
  dropIdx,
  onExpand,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onAdd,
  onUpdate,
  onDelete,
  onUploadDrop,
  onUploadFiles,
  onFileUpload,
  setDragOverUpload,
  uploadAccept,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadTargetRef = useRef<string | null>(null);

  return (
    <div className="w-full">
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-slate-700/20">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Conteúdos · {conteudos.length}
        </p>
        {canEdit ? (
          <div className="flex flex-wrap gap-1.5">
            {TIPOS_CONTEUDO.map((t) => {
              const c = colorMap[t.color];
              return (
                <button
                  key={t.tipo}
                  type="button"
                  disabled={busy}
                  title={t.label}
                  onClick={() => onAdd(t.tipo)}
                  data-guided-flow-anchor={t.tipo === "VIDEO" ? "lms-tipo-conteudo" : undefined}
                  className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-semibold ${c.bg} ${c.text} ${c.border}`}
                >
                  <Plus className="h-3 w-3" /> {t.short}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      {canEdit ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOverUpload(true);
          }}
          onDragLeave={() => setDragOverUpload(false)}
          onDrop={onUploadDrop}
          className={`mx-4 mt-3 mb-2 rounded-xl border-2 border-dashed px-4 py-4 text-center transition-colors ${
            dragOverUpload
              ? "border-teal-400 bg-teal-500/10"
              : "border-slate-600/50 bg-slate-950/40 hover:border-slate-500"
          }`}
        >
          <Upload className="mx-auto mb-1.5 h-6 w-6 text-slate-500" />
          <p className="text-xs text-slate-400">Arrasta vídeos ou documentos · até 200 MB</p>
          <Button type="button" size="sm" variant="secondary" className="mt-2" disabled={busy} onClick={onUploadFiles}>
            Escolher ficheiros
          </Button>
        </div>
      ) : null}

      <div className="p-4 space-y-2 pb-8" data-guided-flow-anchor="lms-lista-conteudos">
        {conteudos.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">Este módulo está vazio. Adiciona conteúdos acima.</p>
        ) : (
          conteudos.map((m, idx) => {
            const t = tipoMeta(m.tipo);
            const c = colorMap[t.color];
            const expanded = expandedId === m.id;
            const meta = fileMeta(m);

            return (
              <div
                key={m.id}
                draggable={canEdit && !expanded}
                onDragStart={() => canEdit && onDragStart(idx)}
                onDragEnd={onDragEnd}
                onDragOver={(e) => {
                  e.preventDefault();
                  onDragOver(idx);
                }}
                onDrop={() => onDrop(idx)}
                className={`rounded-xl border transition-all ${
                  dropIdx === idx ? "border-teal-500/60 ring-2 ring-teal-500/20" : "border-slate-700/30 bg-slate-900/40"
                } ${expanded ? "ring-1 ring-teal-500/30" : ""}`}
              >
                <div className="flex items-stretch gap-1">
                  {canEdit && !expanded ? (
                    <div
                      className="flex shrink-0 cursor-grab items-center px-1.5 text-slate-600"
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      <GripVertical className="h-4 w-4" />
                    </div>
                  ) : null}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => onExpand(expanded ? null : m.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onExpand(expanded ? null : m.id);
                      }
                    }}
                    className={`flex min-w-0 flex-1 items-center gap-3 px-3 py-3 text-left ${
                      expanded ? "" : "cursor-pointer hover:bg-slate-800/30"
                    }`}
                  >
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${c.bg} ${c.text}`}>
                      <t.Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-100 truncate">{m.titulo}</p>
                      <p className={`text-[10px] font-medium ${c.text}`}>{conteudoSubtitle(m)}</p>
                    </div>
                    {m.tipo === "QUIZ" && meta.ponderacaoNota != null ? (
                      <span className="shrink-0 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300 tabular-nums">
                        {meta.ponderacaoNota} % nota
                      </span>
                    ) : null}
                    <span
                      className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                        m.publicado
                          ? "bg-green-500/10 text-green-400 border border-green-500/25"
                          : "bg-slate-800 text-slate-500 border border-slate-700/40"
                      }`}
                    >
                      {m.publicado ? "Publicado" : "Rascunho"}
                    </span>
                    {expanded ? (
                      <span className="shrink-0 text-[10px] text-slate-500">Fechar ▲</span>
                    ) : (
                      <span className="shrink-0 text-[10px] text-slate-600">Expandir ▼</span>
                    )}
                  </div>
                  {canEdit && !expanded ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(m.id);
                      }}
                      className="shrink-0 self-center p-2 text-red-400/70 hover:text-red-300"
                      aria-label="Eliminar"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>

                {expanded ? (
                  <div className="border-t border-slate-700/30 p-5 space-y-4 w-full">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block">
                        <span className="text-[10px] uppercase tracking-wide text-slate-500">Título</span>
                        <input
                          className={`${INPUT_CLASS} mt-1`}
                          value={m.titulo}
                          disabled={!canEdit}
                          onChange={(e) => onUpdate(m.id, { titulo: e.target.value })}
                        />
                      </label>
                      <label className="block sm:col-span-2">
                        <span className="text-[10px] uppercase tracking-wide text-slate-500">Descrição curta</span>
                        <input
                          className={`${INPUT_CLASS} mt-1`}
                          value={meta.descricaoCurta ?? ""}
                          disabled={!canEdit}
                          placeholder="Visível para o formando antes de abrir"
                          onChange={(e) =>
                            onUpdate(m.id, {
                              metadata: { ...meta, descricaoCurta: e.target.value },
                            })
                          }
                        />
                      </label>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase tracking-wide text-slate-500">Estado</span>
                      <div className="mt-1.5 flex rounded-lg border border-slate-700/40 p-0.5 w-fit">
                        <button
                          type="button"
                          disabled={!canEdit}
                          onClick={() => onUpdate(m.id, { publicado: false })}
                          className={`rounded-md px-3 py-1.5 text-[11px] font-medium ${
                            !m.publicado ? "bg-slate-700 text-slate-100" : "text-slate-500"
                          }`}
                        >
                          Rascunho
                        </button>
                        <button
                          type="button"
                          disabled={!canEdit}
                          onClick={() => onUpdate(m.id, { publicado: true })}
                          className={`rounded-md px-3 py-1.5 text-[11px] font-medium ${
                            m.publicado ? "border border-green-500/40 bg-green-500/10 text-green-300" : "text-slate-500"
                          }`}
                        >
                          Publicado
                        </button>
                      </div>
                    </div>

                    {m.tipo === "TEXTO" ? (
                      <label className="block">
                        <span className="text-[10px] uppercase tracking-wide text-slate-500">Conteúdo</span>
                        <textarea
                          rows={14}
                          className={`${INPUT_CLASS} mt-1 resize-y min-h-[280px]`}
                          value={m.conteudoHtml ?? ""}
                          disabled={!canEdit}
                          placeholder="Ao completar este módulo o formando será capaz de..."
                          onChange={(e) => onUpdate(m.id, { conteudoHtml: e.target.value })}
                        />
                      </label>
                    ) : null}

                    {m.tipo === "VIDEO" ? (
                      <label className="block">
                        <span className="text-[10px] uppercase tracking-wide text-slate-500">
                          URL do vídeo (Vimeo, YouTube, MP4)
                        </span>
                        <input
                          className={`${INPUT_CLASS} mt-1`}
                          value={
                            isModuloStorageRef(m.urlOuRef)
                              ? ""
                              : m.urlOuRef?.startsWith("http")
                                ? m.urlOuRef
                                : ""
                          }
                          disabled={!canEdit}
                          placeholder="https://..."
                          onChange={(e) => onUpdate(m.id, { urlOuRef: e.target.value })}
                        />
                      </label>
                    ) : null}

                    {(m.tipo === "VIDEO" || m.tipo === "PDF") && (
                      <div className="rounded-lg border border-slate-700/40 bg-slate-900/50 p-4 space-y-3">
                        {isModuloStorageRef(m.urlOuRef) && m.urlOuRef ? (
                          <ModuloStoredMedia
                            moduloId={m.id}
                            urlOuRef={m.urlOuRef}
                            tipo={m.tipo === "VIDEO" ? "VIDEO" : "PDF"}
                            mimeType={meta.mimeType}
                            fileName={meta.fileName}
                            variant="editor"
                          />
                        ) : null}
                        {meta.fileName ? (
                          <p className="text-xs text-slate-400 truncate">{meta.fileName}</p>
                        ) : null}
                        {meta.sizeBytes ? (
                          <p className="text-[10px] text-slate-500">{formatBytes(meta.sizeBytes)}</p>
                        ) : null}
                        <input
                          ref={fileRef}
                          type="file"
                          className="hidden"
                          accept={m.tipo === "VIDEO" ? "video/*,.mp4,.webm,.mov" : uploadAccept}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void onFileUpload(f, uploadTargetRef.current ?? m.id);
                            e.target.value = "";
                          }}
                        />
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={busy || !canEdit}
                          onClick={() => {
                            uploadTargetRef.current = m.id;
                            fileRef.current?.click();
                          }}
                        >
                          {meta.fileName ? "Substituir ficheiro" : "Carregar ficheiro"}
                        </Button>
                      </div>
                    )}

                    {m.tipo === "QUIZ" ? (
                      <div className="space-y-4">
                        <label className="block w-32">
                          <span className="text-[10px] uppercase tracking-wide text-slate-500">% nota</span>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            className={`${INPUT_CLASS} mt-1 tabular-nums`}
                            value={meta.ponderacaoNota ?? ""}
                            disabled={!canEdit}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) =>
                              onUpdate(m.id, {
                                metadata: {
                                  ...meta,
                                  ponderacaoNota: e.target.value === "" ? undefined : Number(e.target.value) || 0,
                                },
                              })
                            }
                          />
                        </label>
                        <QuizPerguntaEditor moduloId={m.id} canEdit={canEdit} embedded />
                      </div>
                    ) : null}

                    {canEdit ? (
                      <button
                        type="button"
                        onClick={() => onDelete(m.id)}
                        className="text-xs text-red-400 hover:text-red-300"
                      >
                        Eliminar conteúdo
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
