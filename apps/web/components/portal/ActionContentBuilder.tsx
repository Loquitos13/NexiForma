"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { BookMarked, Eye } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { parseApiError } from "@/lib/ui/backoffice";
import { validarModuloConteudoCompleto } from "@nexiforma/shared";
import { Alert, Button } from "@/components/ui";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { FormandoPortalMockup } from "@/components/portal/FormandoPortalMockup";
import { UNIDADE_FLAT_ID } from "@/components/formando/formando-percurso-types";
import { LmsConteudoList } from "@/components/portal/lms-conteudo-list";
import { LmsModuloHeader } from "@/components/portal/lms-modulo-header";
import { LmsModulosSidebar } from "@/components/portal/lms-modulos-sidebar";
import {
  quizPonderacaoTotal,
  type ModuloNode,
  type UnidadeNode,
} from "@/components/portal/lms-modulos-shared";

export type { ModuloNode, UnidadeNode } from "@/components/portal/lms-modulos-shared";

const UPLOAD_ACCEPT =
  "video/*,.mp4,.webm,.mov,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.odt,.odp,.csv,.rtf,image/*";

type Props = {
  cursoId: string;
  cursoTitulo?: string;
  cursoCargaHoras?: number;
  lmsProgressaoSequencial?: boolean;
  acaoTitulo?: string;
  canEdit: boolean;
  initialUnidadeId?: string | null;
  onProgressaoChange?: (sequencial: boolean) => void;
};

function pickInitialUnidadeId(
  unidadeRows: UnidadeNode[],
  moduleRows: ModuloNode[],
  prev: string | null,
): string | null {
  const flat = moduleRows.filter((m) => !m.moduloUnidadeId);
  if (prev === UNIDADE_FLAT_ID) return flat.length > 0 ? UNIDADE_FLAT_ID : unidadeRows[0]?.id ?? null;
  if (prev && unidadeRows.some((u) => u.id === prev)) return prev;
  if (flat.length > 0 && unidadeRows.length === 0) return UNIDADE_FLAT_ID;
  if (flat.length > 0 && unidadeRows.every((u) => moduleRows.filter((m) => m.moduloUnidadeId === u.id).length === 0)) {
    return UNIDADE_FLAT_ID;
  }
  return unidadeRows[0]?.id ?? (flat.length > 0 ? UNIDADE_FLAT_ID : null);
}

export function ActionContentBuilder({
  cursoId,
  cursoTitulo,
  cursoCargaHoras = 0,
  lmsProgressaoSequencial = true,
  acaoTitulo,
  canEdit,
  initialUnidadeId = null,
  onProgressaoChange,
}: Props) {
  const [unidades, setUnidades] = useState<UnidadeNode[]>([]);
  const [modulos, setModulos] = useState<ModuloNode[]>([]);
  const [selectedUnidadeId, setSelectedUnidadeId] = useState<string | null>(null);
  const [expandedConteudoId, setExpandedConteudoId] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [drag, setDrag] = useState<{ fromIdx: number } | null>(null);
  const [dropIdx, setDropIdx] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragOverUpload, setDragOverUpload] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<
    null | { kind: "unidade" | "conteudo"; id: string; titulo: string }
  >(null);
  const bulkUploadRef = useRef<HTMLInputElement>(null);
  const appliedInitialUnidade = useRef<string | null>(null);
  const saveTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const flatModulos = useMemo(
    () => modulos.filter((m) => !m.moduloUnidadeId).sort((a, b) => a.ordem - b.ordem),
    [modulos],
  );

  const conteudosUnidade = useMemo(() => {
    if (selectedUnidadeId === UNIDADE_FLAT_ID) return flatModulos;
    return modulos
      .filter((m) => m.moduloUnidadeId === selectedUnidadeId)
      .sort((a, b) => a.ordem - b.ordem);
  }, [modulos, selectedUnidadeId, flatModulos]);

  const selectedUnidade = useMemo(() => {
    if (selectedUnidadeId === UNIDADE_FLAT_ID) return null;
    return unidades.find((u) => u.id === selectedUnidadeId) ?? null;
  }, [selectedUnidadeId, unidades]);

  const quizPond = selectedUnidadeId && selectedUnidadeId !== UNIDADE_FLAT_ID
    ? quizPonderacaoTotal(modulos, selectedUnidadeId)
    : 0;

  const loadAll = useCallback(async () => {
    if (!cursoId) {
      setUnidades([]);
      setModulos([]);
      return;
    }
    const [uRes, mRes] = await Promise.all([
      bffFetch(`/api/v1/conteudos-lms/unidades?cursoId=${encodeURIComponent(cursoId)}`, {
        headers: { accept: "application/json" },
      }),
      bffFetch(`/api/v1/conteudos-lms/modulos?cursoId=${encodeURIComponent(cursoId)}`, {
        headers: { accept: "application/json" },
      }),
    ]);
    const uRows = uRes.ok ? ((await uRes.json()) as UnidadeNode[]) : [];
    const mRows = mRes.ok ? ((await mRes.json()) as ModuloNode[]) : [];
    setUnidades(uRows);
    setModulos(mRows);
    const prefer =
      initialUnidadeId && uRows.some((u) => u.id === initialUnidadeId) ? initialUnidadeId : null;
    if (prefer && appliedInitialUnidade.current !== prefer) {
      appliedInitialUnidade.current = prefer;
      setSelectedUnidadeId(prefer);
    } else {
      setSelectedUnidadeId((prev) => pickInitialUnidadeId(uRows, mRows, prev));
    }
  }, [cursoId, initialUnidadeId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  function scheduleSave(key: string, fn: () => void) {
    const prev = saveTimers.current.get(key);
    if (prev) clearTimeout(prev);
    saveTimers.current.set(
      key,
      setTimeout(() => {
        saveTimers.current.delete(key);
        fn();
      }, 450),
    );
  }

  async function criarUnidade() {
    if (!canEdit || !cursoId) return;
    setBusy(true);
    setError(null);
    const r = await bffFetch("/api/v1/conteudos-lms/unidades", {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({ cursoId, titulo: `Módulo ${unidades.length + 1}`, ordem: unidades.length }),
    });
    setBusy(false);
    if (!r.ok) {
      setError(await parseApiError(r));
      return;
    }
    const created = (await r.json()) as UnidadeNode;
    setUnidades((p) => [...p, created].sort((a, b) => a.ordem - b.ordem));
    setSelectedUnidadeId(created.id);
    setMsg("Módulo criado.");
  }

  async function persistUnidade(id: string, data: Partial<UnidadeNode>) {
    if (!canEdit) return;
    const r = await bffFetch(`/api/v1/conteudos-lms/unidades/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify(data),
    });
    if (!r.ok) {
      setError(await parseApiError(r));
      void loadAll();
      return;
    }
    const updated = (await r.json()) as UnidadeNode;
    setUnidades((p) => p.map((u) => (u.id === id ? { ...u, ...updated } : u)));
  }

  function patchUnidade(id: string, patch: Partial<UnidadeNode>) {
    setUnidades((p) => p.map((u) => (u.id === id ? { ...u, ...patch } : u)));
    scheduleSave(`u-${id}`, () => void persistUnidade(id, patch));
  }

  async function deleteUnidade(id: string) {
    const u = unidades.find((x) => x.id === id);
    if (!u || !canEdit) return;
    setDeleteConfirm({ kind: "unidade", id, titulo: u.titulo });
  }

  async function confirmDelete() {
    if (!deleteConfirm || !canEdit) return;
    const { kind, id } = deleteConfirm;
    setDeleteConfirm(null);
    if (kind === "unidade") {
      setUnidades((p) => p.filter((x) => x.id !== id));
      setModulos((p) => p.map((m) => (m.moduloUnidadeId === id ? { ...m, moduloUnidadeId: null } : m)));
      if (selectedUnidadeId === id) setSelectedUnidadeId(null);
      const r = await bffFetch(`/api/v1/conteudos-lms/unidades/${id}`, { method: "DELETE" });
      if (!r.ok) {
        setError(await parseApiError(r));
        void loadAll();
        return;
      }
      setMsg("Módulo eliminado.");
      return;
    }
    setModulos((p) => p.filter((x) => x.id !== id));
    if (expandedConteudoId === id) setExpandedConteudoId(null);
    const r = await bffFetch(`/api/v1/conteudos-lms/modulos/${id}`, { method: "DELETE" });
    if (!r.ok) {
      setError(await parseApiError(r));
      void loadAll();
      return;
    }
    setMsg("Conteúdo eliminado.");
  }

  async function adicionarConteudo(tipo: ModuloNode["tipo"]) {
    if (!canEdit || !cursoId || !selectedUnidadeId) {
      setError("Selecciona ou cria um módulo antes de adicionar conteúdo.");
      return;
    }
    setBusy(true);
    setError(null);
    const r = await bffFetch("/api/v1/conteudos-lms/modulos", {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        cursoId,
        moduloUnidadeId: selectedUnidadeId === UNIDADE_FLAT_ID ? undefined : selectedUnidadeId,
        titulo: `Novo ${tipo}`,
        tipo,
        ordem: conteudosUnidade.length,
        publicado: false,
      }),
    });
    setBusy(false);
    if (!r.ok) {
      setError(await parseApiError(r));
      return;
    }
    const created = (await r.json()) as ModuloNode;
    setModulos((p) => [...p, created]);
    setExpandedConteudoId(created.id);
    setMsg("Conteúdo adicionado.");
  }

  async function persistConteudo(id: string, data: Partial<ModuloNode>) {
    if (!canEdit) return;
    const current = modulos.find((m) => m.id === id);
    if (!current) return;
    const merged = { ...current, ...data };
    const check = validarModuloConteudoCompleto(merged);
    const payload: Partial<ModuloNode> = { ...data };
    if (data.publicado === undefined) {
      if (check.ok) payload.publicado = true;
      else payload.publicado = false;
    }
    const r = await bffFetch(`/api/v1/conteudos-lms/modulos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      setError(await parseApiError(r));
      void loadAll();
      return;
    }
    const updated = (await r.json()) as ModuloNode;
    setModulos((p) => p.map((m) => (m.id === id ? { ...m, ...updated } : m)));
  }

  function patchConteudo(id: string, patch: Partial<ModuloNode>) {
    setModulos((p) => p.map((m) => (m.id === id ? { ...m, ...patch } : m)));
    scheduleSave(`c-${id}`, () => void persistConteudo(id, patch));
  }

  async function reorderConteudos(reordered: ModuloNode[]) {
    const ids = new Set(reordered.map((x) => x.id));
    setModulos((prev) => {
      const rest = prev.filter((m) => !ids.has(m.id));
      return [...rest, ...reordered.map((m, i) => ({ ...m, ordem: i }))];
    });
    for (let i = 0; i < reordered.length; i++) {
      await bffFetch(`/api/v1/conteudos-lms/modulos/${reordered[i].id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", accept: "application/json" },
        body: JSON.stringify({ ordem: i }),
      });
    }
  }

  async function handleDrop(idx: number) {
    setDropIdx(null);
    if (!drag || !canEdit) return;
    const fromIdx = drag.fromIdx;
    setDrag(null);
    if (fromIdx === idx) return;
    const reordered = [...conteudosUnidade];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(idx, 0, moved);
    await reorderConteudos(reordered);
  }

  async function uploadFicheiro(file: File, moduloId: string) {
    if (!canEdit) return;
    setBusy(true);
    const fd = new FormData();
    fd.append("file", file);
    const r = await bffFetch(`/api/v1/conteudos-lms/modulos/${moduloId}/upload`, { method: "POST", body: fd });
    setBusy(false);
    if (!r.ok) {
      setError(await parseApiError(r));
      return;
    }
    const updated = (await r.json()) as ModuloNode;
    setModulos((p) => p.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)));
    setExpandedConteudoId(updated.id);
    setMsg(`«${file.name}» carregado.`);
  }

  async function uploadFicheirosLocais(files: FileList | File[]) {
    if (!canEdit || !cursoId || !selectedUnidadeId) return;
    const list = Array.from(files);
    if (!list.length) return;
    setBusy(true);
    let ok = 0;
    let lastId: string | null = null;
    for (const file of list) {
      if (selectedUnidadeId === UNIDADE_FLAT_ID) {
        const tipo = file.type.startsWith("video/") ? "VIDEO" : "PDF";
        const createRes = await bffFetch("/api/v1/conteudos-lms/modulos", {
          method: "POST",
          headers: { "Content-Type": "application/json", accept: "application/json" },
          body: JSON.stringify({
            cursoId,
            titulo: file.name.replace(/\.[^.]+$/, ""),
            tipo,
            ordem: flatModulos.length + ok,
            publicado: false,
          }),
        });
        if (!createRes.ok) break;
        const created = (await createRes.json()) as ModuloNode;
        const fd = new FormData();
        fd.append("file", file);
        const up = await bffFetch(`/api/v1/conteudos-lms/modulos/${created.id}/upload`, { method: "POST", body: fd });
        if (!up.ok) break;
        const updated = (await up.json()) as ModuloNode;
        setModulos((p) => [...p.filter((m) => m.id !== updated.id), updated]);
        lastId = updated.id;
        ok++;
        continue;
      }
      const fd = new FormData();
      fd.append("file", file);
      fd.append("cursoId", cursoId);
      fd.append("moduloUnidadeId", selectedUnidadeId);
      const r = await bffFetch("/api/v1/conteudos-lms/modulos/upload-novo", { method: "POST", body: fd });
      if (!r.ok) break;
      const created = (await r.json()) as ModuloNode;
      setModulos((p) => [...p, created]);
      lastId = created.id;
      ok++;
    }
    setBusy(false);
    if (ok > 0) {
      setMsg(`${ok} ficheiro(s) adicionado(s).`);
      if (lastId) setExpandedConteudoId(lastId);
    }
  }

  function onUploadDrop(e: DragEvent) {
    e.preventDefault();
    setDragOverUpload(false);
    if (!canEdit || busy) return;
    if (e.dataTransfer.files?.length) void uploadFicheirosLocais(e.dataTransfer.files);
  }

  const mockupModulos = useMemo(
    () =>
      [...modulos]
        .filter((m) => m.publicado !== false)
        .sort((a, b) => {
          const ua = unidades.find((u) => u.id === a.moduloUnidadeId)?.ordem ?? 999;
          const ub = unidades.find((u) => u.id === b.moduloUnidadeId)?.ordem ?? 999;
          if (ua !== ub) return ua - ub;
          return a.ordem - b.ordem;
        }),
    [modulos, unidades],
  );

  return (
    <div className="w-full max-w-full space-y-3">
      {error ? <Alert variant="error">{error}</Alert> : null}
      {msg ? <Alert variant="success">{msg}</Alert> : null}

      <div className="flex h-[min(82vh,780px)] max-h-[780px] w-full flex-col overflow-hidden rounded-2xl border border-slate-700/40 bg-slate-950/40 lg:flex-row">
        <LmsModulosSidebar
          cursoCargaHoras={cursoCargaHoras}
          progressaoSequencial={lmsProgressaoSequencial}
          onProgressaoChange={(v) => onProgressaoChange?.(v)}
          unidades={unidades}
          modulos={modulos}
          flatCount={flatModulos.length}
          selectedUnidadeId={selectedUnidadeId}
          canEdit={canEdit}
          busy={busy}
          onSelectUnidade={(id) => {
            setSelectedUnidadeId(id);
            setExpandedConteudoId(null);
          }}
          onCreateUnidade={() => void criarUnidade()}
        />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {!selectedUnidadeId ? (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
              <BookMarked className="mb-3 h-12 w-12 text-slate-600" />
              <p className="text-sm text-slate-400">Selecciona ou cria um módulo para gerir conteúdos.</p>
            </div>
          ) : selectedUnidade ? (
            <>
              <LmsModuloHeader
                unidade={selectedUnidade}
                unidades={unidades}
                canEdit={canEdit}
                busy={busy}
                onUpdate={(patch) => patchUnidade(selectedUnidade.id, patch)}
                onDelete={() => void deleteUnidade(selectedUnidade.id)}
              />
              {quizPond > 0 && quizPond !== 100 ? (
                <div className="mx-4 mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                  Ponderação total dos quizzes: {quizPond}% - deve somar 100% para cálculo correcto da nota.
                </div>
              ) : null}
              <div className="flex shrink-0 justify-end gap-2 px-4 pt-2">
                <Button type="button" size="sm" variant="secondary" onClick={() => setPreviewOpen(true)}>
                  <Eye className="h-3.5 w-3.5" />
                  Pré-visualizar como formando
                </Button>
              </div>
              <LmsConteudoList
                conteudos={conteudosUnidade}
                expandedId={expandedConteudoId}
                canEdit={canEdit}
                busy={busy}
                dragOverUpload={dragOverUpload}
                dropIdx={dropIdx}
                onExpand={setExpandedConteudoId}
                onDragStart={(idx) => setDrag({ fromIdx: idx })}
                onDragEnd={() => {
                  setDrag(null);
                  setDropIdx(null);
                }}
                onDragOver={setDropIdx}
                onDrop={(idx) => void handleDrop(idx)}
                onAdd={(tipo) => void adicionarConteudo(tipo)}
                onUpdate={patchConteudo}
                onDelete={(id) => {
                  const m = modulos.find((x) => x.id === id);
                  if (m) setDeleteConfirm({ kind: "conteudo", id, titulo: m.titulo });
                }}
                onUploadDrop={onUploadDrop}
                onUploadFiles={() => bulkUploadRef.current?.click()}
                onFileUpload={(f, id) => void uploadFicheiro(f, id)}
                setDragOverUpload={setDragOverUpload}
                uploadAccept={UPLOAD_ACCEPT}
              />
            </>
          ) : (
            <>
              <div className="border-b border-slate-700/30 px-4 py-3">
                <h2 className="text-base font-semibold text-slate-100">Percurso directo</h2>
                <p className="text-xs text-slate-500">Conteúdos sem módulo associado</p>
              </div>
              <LmsConteudoList
                conteudos={conteudosUnidade}
                expandedId={expandedConteudoId}
                canEdit={canEdit}
                busy={busy}
                dragOverUpload={dragOverUpload}
                dropIdx={dropIdx}
                onExpand={setExpandedConteudoId}
                onDragStart={(idx) => setDrag({ fromIdx: idx })}
                onDragEnd={() => {
                  setDrag(null);
                  setDropIdx(null);
                }}
                onDragOver={setDropIdx}
                onDrop={(idx) => void handleDrop(idx)}
                onAdd={(tipo) => void adicionarConteudo(tipo)}
                onUpdate={patchConteudo}
                onDelete={(id) => {
                  const m = modulos.find((x) => x.id === id);
                  if (m) setDeleteConfirm({ kind: "conteudo", id, titulo: m.titulo });
                }}
                onUploadDrop={onUploadDrop}
                onUploadFiles={() => bulkUploadRef.current?.click()}
                onFileUpload={(f, id) => void uploadFicheiro(f, id)}
                setDragOverUpload={setDragOverUpload}
                uploadAccept={UPLOAD_ACCEPT}
              />
            </>
          )}
        </div>
      </div>

      <input
        ref={bulkUploadRef}
        type="file"
        className="hidden"
        multiple
        accept={UPLOAD_ACCEPT}
        onChange={(e) => {
          if (e.target.files?.length) void uploadFicheirosLocais(e.target.files);
          e.target.value = "";
        }}
      />

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent title="Pré-visualização · formando" className="max-w-lg">
          <div className="h-[min(70vh,520px)] overflow-hidden rounded-xl border border-slate-700/40">
            <FormandoPortalMockup
              cursoTitulo={cursoTitulo ?? "Curso"}
              acaoTitulo={acaoTitulo ?? cursoTitulo}
              unidades={unidades}
              modulos={mockupModulos}
              highlightedModuloId={expandedConteudoId}
              viewerModulo={null}
              onModuloClick={() => undefined}
              onOpenViewer={() => undefined}
              onBackFromViewer={() => undefined}
              className="h-full"
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent
          title={deleteConfirm?.kind === "unidade" ? "Eliminar módulo" : "Eliminar conteúdo"}
          description={
            deleteConfirm?.kind === "unidade"
              ? "Os conteúdos deste módulo ficam sem módulo associado."
              : "Esta acção não pode ser anulada."
          }
        >
          <div className="flex flex-wrap gap-2 justify-end pt-2">
            <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>
              Cancelar
            </Button>
            <Button className="bg-red-600 hover:bg-red-500" onClick={() => void confirmDelete()}>
              Eliminar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
