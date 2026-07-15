"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import {
  BookMarked,
  ChevronDown,
  ChevronUp,
  Eye,
  FileText,
  GripVertical,
  HelpCircle,
  Link2,
  Pencil,
  Plus,
  Trash2,
  Type,
  Upload,
  Video,
} from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { parseApiError } from "@/lib/ui/backoffice";
import { isModuloStorageRef, validarModuloConteudoCompleto } from "@nexiforma/shared";
import { ModuloStoredMedia } from "@/components/lms/ModuloStoredMedia";
import { Alert, Button } from "@/components/ui";
import { QuizPerguntaEditor } from "@/components/portal/QuizPerguntaEditor";
import { FormandoPortalMockup } from "@/components/portal/FormandoPortalMockup";
import { UNIDADE_FLAT_ID } from "@/components/formando/formando-percurso-types";

export type UnidadeNode = {
  id: string;
  codigo: string | null;
  titulo: string;
  descricao: string | null;
  cargaHoras: number | null;
  formadorId: string | null;
  formador?: { id: string; nomeCompleto: string } | null;
  ordem: number;
  notaMinima: number | null;
  _count?: { conteudos: number };
};

export type ModuloNode = {
  id: string;
  titulo: string;
  tipo: "VIDEO" | "PDF" | "TEXTO" | "QUIZ" | "WEBINAR";
  ordem: number;
  moduloUnidadeId: string | null;
  duracaoMin: number | null;
  urlOuRef: string | null;
  conteudoHtml: string | null;
  notaMinima: number | null;
  prerequisitoModuloId: string | null;
  publicado: boolean;
  metadata?: Record<string, unknown> | null;
};

const TIPOS = [
  { tipo: "VIDEO" as const, label: "Vídeo", short: "Vídeo", color: "blue", Icon: Video },
  { tipo: "WEBINAR" as const, label: "Webinar", short: "Webinar", color: "cyan", Icon: Link2 },
  { tipo: "PDF" as const, label: "Documento", short: "PDF", color: "red", Icon: FileText },
  { tipo: "TEXTO" as const, label: "Texto", short: "Texto", color: "slate", Icon: Type },
  { tipo: "QUIZ" as const, label: "Quiz", short: "Quiz", color: "purple", Icon: HelpCircle },
] as const;

const colorMap: Record<string, { bg: string; text: string; border: string; ring: string }> = {
  blue: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/30", ring: "ring-blue-500/40" },
  cyan: { bg: "bg-cyan-500/10", text: "text-cyan-400", border: "border-cyan-500/30", ring: "ring-cyan-500/40" },
  red: { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/30", ring: "ring-red-500/40" },
  slate: { bg: "bg-slate-500/10", text: "text-slate-400", border: "border-slate-500/30", ring: "ring-slate-500/40" },
  purple: { bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/30", ring: "ring-purple-500/40" },
};

type Props = {
  cursoId: string;
  cursoTitulo?: string;
  acaoTitulo?: string;
  canEdit: boolean;
};

type RightPanel = "edit" | "preview";
type EditTarget = "conteudo" | "unidade";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileMeta(modulo: ModuloNode): { fileName?: string; mimeType?: string; sizeBytes?: number } {
  const m = modulo.metadata;
  if (!m || typeof m !== "object") return {};
  return {
    fileName: typeof m.fileName === "string" ? m.fileName : undefined,
    mimeType: typeof m.mimeType === "string" ? m.mimeType : undefined,
    sizeBytes: typeof m.sizeBytes === "number" ? m.sizeBytes : undefined,
  };
}

function tipoMeta(tipo: ModuloNode["tipo"]) {
  return TIPOS.find((x) => x.tipo === tipo) ?? TIPOS[3];
}

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

const UPLOAD_ACCEPT =
  "video/*,.mp4,.webm,.mov,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.odt,.odp,.csv,.rtf,image/*";

export function ActionContentBuilder({ cursoId, cursoTitulo, acaoTitulo, canEdit }: Props) {
  const [unidades, setUnidades] = useState<UnidadeNode[]>([]);
  const [formadores, setFormadores] = useState<Array<{ id: string; nomeCompleto: string }>>([]);
  const [modulos, setModulos] = useState<ModuloNode[]>([]);
  const [selectedUnidadeId, setSelectedUnidadeId] = useState<string | null>(null);
  const [selectedConteudoId, setSelectedConteudoId] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<EditTarget>("conteudo");
  const [rightPanel, setRightPanel] = useState<RightPanel>("edit");
  const [previewViewerId, setPreviewViewerId] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ fromIdx: number } | null>(null);
  const [dropIdx, setDropIdx] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragOverUpload, setDragOverUpload] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const bulkUploadRef = useRef<HTMLInputElement>(null);

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
    if (selectedUnidadeId === UNIDADE_FLAT_ID) {
      return {
        id: UNIDADE_FLAT_ID,
        codigo: null,
        titulo: "Percurso directo",
        descricao: "Conteúdos do fluxo guiado ou sem módulo associado",
        cargaHoras: null,
        formadorId: null,
        ordem: -1,
        notaMinima: null,
      } satisfies UnidadeNode;
    }
    return unidades.find((u) => u.id === selectedUnidadeId) ?? null;
  }, [selectedUnidadeId, unidades]);
  const selectedConteudo = conteudosUnidade.find((m) => m.id === selectedConteudoId) ?? null;

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
    setSelectedUnidadeId((prev) => pickInitialUnidadeId(uRows, mRows, prev));
  }, [cursoId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    void bffFetch("/api/v1/formadores", { headers: { accept: "application/json" } }).then(async (r) => {
      if (r.ok) setFormadores((await r.json()) as Array<{ id: string; nomeCompleto: string }>);
    });
  }, []);

  async function criarUnidade() {
    if (!canEdit || !cursoId) return;
    setBusy(true);
    setError(null);
    const titulo = `Módulo ${unidades.length + 1}`;
    const r = await bffFetch("/api/v1/conteudos-lms/unidades", {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({ cursoId, titulo, ordem: unidades.length }),
    });
    setBusy(false);
    if (!r.ok) {
      setError(await parseApiError(r));
      return;
    }
    const created = (await r.json()) as UnidadeNode;
    setUnidades((p) => [...p, created].sort((a, b) => a.ordem - b.ordem));
    setMsg("Módulo criado.");
    setSelectedUnidadeId(created.id);
    setSelectedConteudoId(null);
    setEditTarget("unidade");
    setRightPanel("edit");
  }

  async function updateUnidade(id: string, data: Partial<UnidadeNode>) {
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
    setMsg("Módulo guardado.");
  }

  async function deleteUnidade(id: string) {
    const u = unidades.find((x) => x.id === id);
    if (!u || !canEdit || !confirm(`Eliminar módulo "${u.titulo}"? Os conteúdos ficam sem módulo.`)) return;
    setUnidades((p) => p.filter((x) => x.id !== id));
    setModulos((p) => p.map((m) => (m.moduloUnidadeId === id ? { ...m, moduloUnidadeId: null } : m)));
    if (selectedUnidadeId === id) {
      setSelectedUnidadeId(null);
      setSelectedConteudoId(null);
    }
    const r = await bffFetch(`/api/v1/conteudos-lms/unidades/${id}`, { method: "DELETE" });
    if (!r.ok) {
      setError(await parseApiError(r));
      void loadAll();
      return;
    }
    setMsg("Módulo eliminado.");
  }

  async function reorderUnidades(reordered: UnidadeNode[]) {
    setUnidades(reordered.map((u, i) => ({ ...u, ordem: i })));
    for (let i = 0; i < reordered.length; i++) {
      await bffFetch(`/api/v1/conteudos-lms/unidades/${reordered[i].id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", accept: "application/json" },
        body: JSON.stringify({ ordem: i }),
      });
    }
  }

  async function moveUnidade(idx: number, direction: -1 | 1) {
    const target = idx + direction;
    if (target < 0 || target >= unidades.length || !canEdit) return;
    const reordered = [...unidades];
    [reordered[idx], reordered[target]] = [reordered[target], reordered[idx]];
    await reorderUnidades(reordered);
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
    setMsg("Conteúdo adicionado.");
    setSelectedConteudoId(created.id);
    setEditTarget("conteudo");
    setRightPanel("edit");
  }

  async function updateConteudo(id: string, data: Partial<ModuloNode>) {
    if (!canEdit) return;
    const current = modulos.find((m) => m.id === id);
    if (!current) return;
    const merged = { ...current, ...data };
    const check = validarModuloConteudoCompleto(merged);
    const payload: Partial<ModuloNode> = { ...data };
    if (check.ok) {
      payload.publicado = true;
      setError(null);
    } else {
      payload.publicado = false;
      setError(check.message);
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
    if (check.ok) setMsg("Guardado e publicado.");
    else setMsg("Guardado como rascunho - completa o conteúdo para publicar.");
  }

  async function deleteConteudo(id: string) {
    const m = modulos.find((x) => x.id === id);
    if (!m || !canEdit || !confirm(`Eliminar "${m.titulo}"?`)) return;
    setModulos((p) => p.filter((x) => x.id !== id));
    if (selectedConteudoId === id) setSelectedConteudoId(null);
    if (previewViewerId === id) setPreviewViewerId(null);
    const r = await bffFetch(`/api/v1/conteudos-lms/modulos/${id}`, { method: "DELETE" });
    if (!r.ok) {
      setError(await parseApiError(r));
      void loadAll();
      return;
    }
    setMsg("Conteúdo eliminado.");
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

  async function moveConteudo(idx: number, direction: -1 | 1) {
    const target = idx + direction;
    if (target < 0 || target >= conteudosUnidade.length || !canEdit) return;
    const reordered = [...conteudosUnidade];
    [reordered[idx], reordered[target]] = [reordered[target], reordered[idx]];
    if (selectedConteudoId === reordered[target].id) setSelectedConteudoId(reordered[target].id);
    await reorderConteudos(reordered);
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
    if (selectedConteudoId === moved.id) setSelectedConteudoId(moved.id);
    await reorderConteudos(reordered);
  }

  async function uploadFicheiro(file: File, moduloId: string) {
    if (!canEdit) return;
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.append("file", file);
    const r = await bffFetch(`/api/v1/conteudos-lms/modulos/${moduloId}/upload`, {
      method: "POST",
      body: fd,
    });
    setBusy(false);
    if (!r.ok) {
      setError(await parseApiError(r));
      return;
    }
    setMsg(`«${file.name}» carregado.`);
    const updated = (await r.json()) as ModuloNode;
    setModulos((p) => p.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)));
    setSelectedConteudoId(updated.id);
    setEditTarget("conteudo");
    setRightPanel("edit");
  }

  async function uploadFicheirosLocais(files: FileList | File[]) {
    if (!canEdit || !cursoId || !selectedUnidadeId) {
      setError("Selecciona ou cria um módulo antes de carregar ficheiros.");
      return;
    }
    const list = Array.from(files);
    if (!list.length) return;

    setBusy(true);
    setError(null);
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
        if (!createRes.ok) {
          setError(await parseApiError(createRes));
          break;
        }
        const created = (await createRes.json()) as ModuloNode;
        const fd = new FormData();
        fd.append("file", file);
        const up = await bffFetch(`/api/v1/conteudos-lms/modulos/${created.id}/upload`, {
          method: "POST",
          body: fd,
        });
        if (!up.ok) {
          setError(await parseApiError(up));
          break;
        }
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
      const r = await bffFetch("/api/v1/conteudos-lms/modulos/upload-novo", {
        method: "POST",
        body: fd,
      });
      if (!r.ok) {
        setError(await parseApiError(r));
        break;
      }
      const created = (await r.json()) as ModuloNode;
      setModulos((p) => [...p, created]);
      lastId = created.id;
      ok++;
    }

    setBusy(false);
    if (ok > 0) {
      setMsg(`${ok} ficheiro(s) adicionado(s) ao módulo.`);
      if (lastId) {
        setSelectedConteudoId(lastId);
        setEditTarget("conteudo");
        setRightPanel("edit");
      }
    }
  }

  function onUploadDrop(e: DragEvent) {
    e.preventDefault();
    setDragOverUpload(false);
    if (!canEdit || busy) return;
    if (e.dataTransfer.files?.length) void uploadFicheirosLocais(e.dataTransfer.files);
  }

  const inputClass =
    "w-full min-w-0 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700/60 text-sm text-slate-200 outline-none focus:border-blue-500/50";

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

  const viewerModulo = useMemo(
    () => (previewViewerId ? modulos.find((m) => m.id === previewViewerId) ?? null : null),
    [modulos, previewViewerId],
  );

  const mockupProps = useMemo(
    () => ({
      cursoTitulo: cursoTitulo ?? "Curso",
      acaoTitulo: acaoTitulo ?? cursoTitulo,
      unidades,
      modulos: mockupModulos,
      highlightedModuloId: selectedConteudoId,
      viewerModulo,
      onModuloClick: (id: string) => {
        setSelectedConteudoId(id);
        const m = modulos.find((x) => x.id === id);
        if (m?.moduloUnidadeId) setSelectedUnidadeId(m.moduloUnidadeId);
        else setSelectedUnidadeId(UNIDADE_FLAT_ID);
        setPreviewViewerId(null);
        setEditTarget("conteudo");
        setRightPanel("edit");
      },
      onOpenViewer: (id: string) => {
        setSelectedConteudoId(id);
        setPreviewViewerId(id);
        setRightPanel("preview");
      },
      onBackFromViewer: () => setPreviewViewerId(null),
    }),
    [
      acaoTitulo,
      cursoTitulo,
      mockupModulos,
      modulos,
      selectedConteudoId,
      unidades,
      viewerModulo,
    ],
  );

  return (
    <div className="w-full max-w-full space-y-3">
      {error ? <Alert variant="error">{error}</Alert> : null}
      {msg ? <Alert variant="success">{msg}</Alert> : null}

      <div className="flex h-[min(80vh,760px)] max-h-[760px] w-full max-w-full flex-col overflow-hidden rounded-2xl border border-slate-700/40 bg-slate-950/40">
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row overflow-hidden">
          {/* Módulos (unidades) */}
          <aside className="shrink-0 border-b lg:border-b-0 lg:border-r border-slate-700/30 lg:w-56 overflow-y-auto overflow-x-hidden p-3">
            <div className="flex items-center justify-between gap-2 mb-2">
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Módulos</h3>
              {canEdit ? (
                <button
                  type="button"
                  title="Novo módulo"
                  disabled={busy}
                  onClick={() => void criarUnidade()}
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-600/20 text-teal-400 hover:bg-teal-600/30"
                >
                  <Plus className="h-4 w-4" />
                </button>
              ) : null}
            </div>
            <p className="text-[11px] text-slate-600 mb-3 truncate">{cursoTitulo ?? "Curso"}</p>

            {unidades.length === 0 && flatModulos.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">
                Cria o primeiro módulo (ex.: Introdução à segurança alimentar).
              </p>
            ) : (
              <div className="space-y-1.5">
                {flatModulos.length > 0 ? (
                  <div
                    className={`flex items-stretch rounded-xl border transition-colors ${
                      selectedUnidadeId === UNIDADE_FLAT_ID
                        ? "border-blue-500/40 bg-blue-500/10 ring-1 ring-blue-500/20"
                        : "border-slate-700/30 bg-slate-900/40"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedUnidadeId(UNIDADE_FLAT_ID);
                        setSelectedConteudoId(null);
                        setEditTarget("conteudo");
                        setRightPanel("edit");
                      }}
                      className="flex min-w-0 flex-1 items-start gap-2 px-2.5 py-2.5 text-left"
                    >
                      <BookMarked
                        className={`h-4 w-4 shrink-0 mt-0.5 ${
                          selectedUnidadeId === UNIDADE_FLAT_ID ? "text-blue-400" : "text-slate-500"
                        }`}
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-100 line-clamp-2">Percurso directo</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          {flatModulos.length} conteúdo(s) · fluxo guiado
                        </p>
                      </div>
                    </button>
                  </div>
                ) : null}
                {unidades.map((u, idx) => {
                  const active = selectedUnidadeId === u.id;
                  const count = modulos.filter((m) => m.moduloUnidadeId === u.id).length;
                  return (
                    <div
                      key={u.id}
                      className={`flex items-stretch gap-0.5 rounded-xl border transition-colors ${
                        active ? "border-teal-500/40 bg-teal-500/10 ring-1 ring-teal-500/20" : "border-slate-700/30 bg-slate-900/40"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedUnidadeId(u.id);
                          setSelectedConteudoId(null);
                          setEditTarget("unidade");
                          setRightPanel("edit");
                        }}
                        className="flex min-w-0 flex-1 items-start gap-2 px-2.5 py-2.5 text-left"
                      >
                        <BookMarked className={`h-4 w-4 shrink-0 mt-0.5 ${active ? "text-teal-400" : "text-slate-500"}`} />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-100 line-clamp-2">{u.titulo}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">{count} conteúdo(s)</p>
                        </div>
                      </button>
                      {canEdit ? (
                        <div className="flex flex-col border-l border-slate-700/30 py-1">
                          <button type="button" disabled={idx === 0 || busy} onClick={() => void moveUnidade(idx, -1)}
                            className="flex h-6 w-6 items-center justify-center text-slate-500 hover:text-slate-200 disabled:opacity-30">
                            <ChevronUp className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" disabled={idx === unidades.length - 1 || busy} onClick={() => void moveUnidade(idx, 1)}
                            className="flex h-6 w-6 items-center justify-center text-slate-500 hover:text-slate-200 disabled:opacity-30">
                            <ChevronDown className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" onClick={() => void deleteUnidade(u.id)}
                            className="flex h-6 w-6 items-center justify-center text-red-400/70 hover:text-red-300">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </aside>

          {/* Lista de conteúdos do módulo seleccionado */}
          <div className="flex min-h-0 min-w-0 w-full shrink-0 flex-col overflow-hidden border-b lg:border-b-0 lg:border-r border-slate-700/30 lg:w-72 xl:w-80">
            <div className="shrink-0 flex items-center justify-between gap-2 border-b border-slate-700/30 px-4 py-2">
              <p className="text-xs font-medium text-slate-400 truncate">
                {selectedUnidade ? selectedUnidade.titulo : "Selecciona um módulo"}
              </p>
              <div className="flex rounded-lg border border-slate-700/40 p-0.5 shrink-0 lg:hidden">
                <button type="button" onClick={() => setRightPanel("edit")}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium ${rightPanel === "edit" ? "bg-slate-700 text-slate-100" : "text-slate-500"}`}>
                  <Pencil className="h-3 w-3" />Editar
                </button>
                <button type="button" onClick={() => { setRightPanel("preview"); setPreviewViewerId(null); }}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium ${rightPanel === "preview" ? "bg-slate-700 text-slate-100" : "text-slate-500"}`}>
                  <Eye className="h-3 w-3" />Mockup
                </button>
              </div>
            </div>

            {selectedUnidade && canEdit ? (
              <div className="shrink-0 border-b border-slate-700/20 bg-slate-900/30">
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOverUpload(true); }}
                  onDragLeave={() => setDragOverUpload(false)}
                  onDrop={onUploadDrop}
                  className={`mx-3 mt-3 mb-2 rounded-xl border-2 border-dashed px-4 py-5 text-center transition-colors ${
                    dragOverUpload
                      ? "border-teal-400 bg-teal-500/10"
                      : "border-slate-600/50 bg-slate-950/40 hover:border-slate-500"
                  }`}
                >
                  <Upload className="h-7 w-7 mx-auto text-slate-500 mb-2" />
                  <p className="text-xs text-slate-300 font-medium">Arrasta vídeos ou documentos para aqui</p>
                  <p className="text-[10px] text-slate-500 mt-1">
                    MP4, PDF, Word, PowerPoint, Excel, imagens - até 200 MB
                  </p>
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
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="mt-3"
                    disabled={busy}
                    onClick={() => bulkUploadRef.current?.click()}
                  >
                    Escolher ficheiros do computador
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5 px-3 pb-3">
                  <span className="text-[10px] text-slate-500 w-full mb-0.5">Ou criar conteúdo vazio:</span>
                  {TIPOS.map((t) => {
                    const c = colorMap[t.color];
                    return (
                      <button key={t.tipo} type="button" disabled={busy} title={t.label}
                        onClick={() => void adicionarConteudo(t.tipo)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-semibold ${c.bg} ${c.text} ${c.border}`}>
                        <t.Icon className="h-3.5 w-3.5" /><Plus className="h-3 w-3" />{t.short}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4">
              {!selectedUnidadeId ? (
                <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                  <BookMarked className="h-10 w-10 text-slate-600 mb-3" />
                  <p className="text-sm text-slate-500">Cria ou selecciona um módulo para organizar os conteúdos.</p>
                </div>
              ) : conteudosUnidade.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-12 text-center px-4">
                  <Upload className="h-10 w-10 text-slate-600 mb-3" />
                  <p className="text-sm text-slate-500">Este módulo está vazio.</p>
                  <p className="text-xs text-slate-600 mt-1">Arrasta ficheiros do teu computador ou usa os botões acima.</p>
                </div>
              ) : (
                <div className="mx-auto w-full max-w-2xl space-y-2">
                  {conteudosUnidade.map((m, idx) => {
                    const t = tipoMeta(m.tipo);
                    const c = colorMap[t.color];
                    const isSelected = selectedConteudoId === m.id;
                    const meta = fileMeta(m);
                    const hasFile = Boolean(m.urlOuRef);
                    return (
                      <div key={m.id} draggable={canEdit}
                        onDragStart={() => canEdit && setDrag({ fromIdx: idx })}
                        onDragEnd={() => { setDrag(null); setDropIdx(null); }}
                        onDragOver={(e) => { e.preventDefault(); setDropIdx(idx); }}
                        onDrop={() => void handleDrop(idx)}
                        className={`group flex items-stretch gap-1 rounded-xl border transition-all ${
                          dropIdx === idx ? "border-blue-500/60 ring-2 ring-blue-500/20" : ""
                        } ${isSelected ? `${c.bg} ${c.border} ring-1 ${c.ring}` : "border-slate-700/30 bg-slate-900/40"}`}>
                        {canEdit ? (
                          <div className="flex shrink-0 items-center px-1.5 cursor-grab text-slate-600">
                            <GripVertical className="h-4 w-4" />
                          </div>
                        ) : null}
                        <button type="button" onClick={() => { setSelectedConteudoId(m.id); setEditTarget("conteudo"); setRightPanel("edit"); }}
                          className="flex min-w-0 flex-1 items-center gap-3 px-3 py-3 text-left">
                          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${c.bg} ${c.text}`}>
                            <t.Icon className="h-4 w-4" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-slate-100 truncate">{m.titulo}</p>
                            <p className={`text-[10px] font-medium ${c.text}`}>
                              {t.short}
                              {!m.publicado ? " · rascunho" : ""}
                              {hasFile && meta.fileName ? ` · ${meta.fileName}` : hasFile ? " · ficheiro" : ""}
                            </p>
                          </div>
                        </button>
                        {canEdit ? (
                          <div className="flex flex-col items-center justify-center gap-0.5 border-l border-slate-700/30 px-1.5 py-1">
                            <button type="button" disabled={idx === 0 || busy} onClick={() => void moveConteudo(idx, -1)}
                              className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-800 disabled:opacity-30">
                              <ChevronUp className="h-4 w-4" />
                            </button>
                            <button type="button" disabled={idx === conteudosUnidade.length - 1 || busy} onClick={() => void moveConteudo(idx, 1)}
                              className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-800 disabled:opacity-30">
                              <ChevronDown className="h-4 w-4" />
                            </button>
                            <button type="button" disabled={busy} onClick={() => void deleteConteudo(m.id)}
                              className="flex h-7 w-7 items-center justify-center rounded-md text-red-400/80 hover:bg-red-950/50">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Editor (centro) + mockup (direita) — desktop */}
          <div className="hidden lg:flex min-h-0 min-w-0 flex-1 overflow-hidden">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-r border-slate-700/30 bg-slate-950/30">
              {canEdit ? (
              editTarget === "unidade" && selectedUnidade && selectedUnidadeId !== UNIDADE_FLAT_ID ? (
                <div className="min-h-0 flex-1 overflow-y-auto p-5 space-y-4">
                  <h3 className="text-base font-semibold text-slate-200 flex items-center gap-2">
                    <BookMarked className="h-4 w-4 text-teal-400" />
                    Editar módulo
                  </h3>
                  <label className="block max-w-xl">
                    <span className="text-xs text-slate-400 mb-1 block">Código (cronograma DGERT)</span>
                    <input className={inputClass} value={selectedUnidade.codigo ?? ""}
                      placeholder="Ex: FPA, AC"
                      onChange={(e) => setUnidades((p) => p.map((u) => u.id === selectedUnidade.id ? { ...u, codigo: e.target.value.toUpperCase() } : u))}
                      onBlur={() => void updateUnidade(selectedUnidade.id, { codigo: selectedUnidade.codigo ?? "" })} />
                  </label>
                  <label className="block max-w-xl">
                    <span className="text-xs text-slate-400 mb-1 block">Título do módulo</span>
                    <input className={inputClass} value={selectedUnidade.titulo}
                      onChange={(e) => setUnidades((p) => p.map((u) => u.id === selectedUnidade.id ? { ...u, titulo: e.target.value } : u))}
                      onBlur={() => void updateUnidade(selectedUnidade.id, { titulo: selectedUnidade.titulo })} />
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl">
                    <label className="block">
                      <span className="text-xs text-slate-400 mb-1 block">Horas do módulo</span>
                      <input type="number" min={0} className={inputClass} value={selectedUnidade.cargaHoras ?? ""}
                        onChange={(e) => {
                          const v = e.target.value === "" ? null : Number(e.target.value);
                          setUnidades((p) => p.map((u) => u.id === selectedUnidade.id ? { ...u, cargaHoras: v } : u));
                        }}
                        onBlur={() => void updateUnidade(selectedUnidade.id, { cargaHoras: selectedUnidade.cargaHoras })} />
                    </label>
                    <label className="block">
                      <span className="text-xs text-slate-400 mb-1 block">Formador</span>
                      <select className={inputClass} value={selectedUnidade.formadorId ?? ""}
                        onChange={(e) => {
                          const v = e.target.value || null;
                          setUnidades((p) => p.map((u) => u.id === selectedUnidade.id ? { ...u, formadorId: v } : u));
                          void updateUnidade(selectedUnidade.id, { formadorId: v });
                        }}>
                        <option value="">-</option>
                        {formadores.map((f) => (
                          <option key={f.id} value={f.id}>{f.nomeCompleto}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label className="block max-w-2xl">
                    <span className="text-xs text-slate-400 mb-1 block">Descrição (opcional)</span>
                    <textarea rows={4} className={`${inputClass} resize-y min-h-[96px]`}
                      value={selectedUnidade.descricao ?? ""}
                      onChange={(e) => setUnidades((p) => p.map((u) => u.id === selectedUnidade.id ? { ...u, descricao: e.target.value } : u))}
                      onBlur={() => void updateUnidade(selectedUnidade.id, { descricao: selectedUnidade.descricao ?? "" })} />
                  </label>
                  <label className="block max-w-xs">
                    <span className="text-xs text-slate-400 mb-1 block">Nota mínima para desbloquear o módulo seguinte (%)</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      className={inputClass}
                      value={selectedUnidade.notaMinima ?? 60}
                      onChange={(e) => {
                        const v = Math.min(100, Math.max(0, Number(e.target.value) || 0));
                        setUnidades((p) => p.map((u) => u.id === selectedUnidade.id ? { ...u, notaMinima: v } : u));
                      }}
                      onBlur={() => void updateUnidade(selectedUnidade.id, { notaMinima: selectedUnidade.notaMinima ?? 60 })}
                    />
                    <p className="text-[10px] text-slate-600 mt-1">
                      O formando precisa desta média no módulo para aceder ao seguinte.
                    </p>
                  </label>
                </div>
              ) : selectedConteudo ? (
                <div className="min-h-0 flex flex-1 flex-col overflow-hidden">
                  <div className="shrink-0 px-5 py-3 border-b border-slate-700/40 bg-slate-900/40">
                    <h3 className="text-base font-semibold text-slate-200 flex items-center gap-2">
                      <Pencil className="h-4 w-4 text-blue-400" />
                      Editar conteúdo
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 truncate">{selectedConteudo.titulo}</p>
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
                    <label className="block">
                      <span className="text-xs text-slate-400 mb-1 block">Título</span>
                      <input className={inputClass} value={selectedConteudo.titulo}
                        onChange={(e) => setModulos((p) => p.map((x) => x.id === selectedConteudo.id ? { ...x, titulo: e.target.value } : x))}
                        onBlur={() => void updateConteudo(selectedConteudo.id, { titulo: selectedConteudo.titulo })} />
                    </label>
                    {selectedConteudo.tipo === "WEBINAR" ? (
                      <input placeholder="URL webinar" className={inputClass} value={selectedConteudo.urlOuRef ?? ""}
                        onChange={(e) => setModulos((p) => p.map((x) => x.id === selectedConteudo.id ? { ...x, urlOuRef: e.target.value } : x))}
                        onBlur={() => void updateConteudo(selectedConteudo.id, { urlOuRef: selectedConteudo.urlOuRef ?? "" })} />
                    ) : null}
                    {selectedConteudo.tipo === "TEXTO" ? (
                      <textarea rows={8} className={`${inputClass} resize-y min-h-[160px]`} value={selectedConteudo.conteudoHtml ?? ""}
                        onChange={(e) => setModulos((p) => p.map((x) => x.id === selectedConteudo.id ? { ...x, conteudoHtml: e.target.value } : x))}
                        onBlur={() => void updateConteudo(selectedConteudo.id, { conteudoHtml: selectedConteudo.conteudoHtml ?? "" })} />
                    ) : null}
                    {selectedConteudo.tipo === "VIDEO" || selectedConteudo.tipo === "PDF" ? (
                      <>
                        {(() => {
                          const meta = fileMeta(selectedConteudo);
                          const isStored = isModuloStorageRef(selectedConteudo.urlOuRef);
                          const externalUrl =
                            !isStored &&
                            (selectedConteudo.urlOuRef?.startsWith("http://") ||
                              selectedConteudo.urlOuRef?.startsWith("https://"))
                              ? selectedConteudo.urlOuRef
                              : null;
                          const hasFile = isStored || !!externalUrl || !!meta.fileName;
                          return (
                            <div className="rounded-lg border border-slate-700/40 bg-slate-900/50 p-4 space-y-3">
                              {isStored && selectedConteudo.urlOuRef ? (
                                <ModuloStoredMedia
                                  moduloId={selectedConteudo.id}
                                  urlOuRef={selectedConteudo.urlOuRef}
                                  tipo={selectedConteudo.tipo === "VIDEO" ? "VIDEO" : "PDF"}
                                  mimeType={meta.mimeType}
                                  fileName={meta.fileName}
                                  variant="preview"
                                  showActions
                                />
                              ) : null}
                              {!isStored && externalUrl && selectedConteudo.tipo === "VIDEO" ? (
                                <video controls className="w-full rounded-lg max-h-56 bg-black" src={externalUrl} />
                              ) : null}
                              {!isStored && externalUrl && selectedConteudo.tipo === "PDF" && meta.mimeType?.startsWith("image/") ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={externalUrl} alt={meta.fileName ?? "Documento"} className="max-h-56 rounded-lg mx-auto" />
                              ) : null}
                              {hasFile ? (
                                <div className="text-xs text-slate-400 space-y-1">
                                  <p className="truncate"><span className="text-slate-500">Ficheiro:</span> {meta.fileName ?? externalUrl}</p>
                                  {meta.sizeBytes ? <p><span className="text-slate-500">Tamanho:</span> {formatBytes(meta.sizeBytes)}</p> : null}
                                  {!isStored && externalUrl ? (
                                    <a href={externalUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 inline-block">
                                      Abrir ficheiro
                                    </a>
                                  ) : null}
                                </div>
                              ) : (
                                <p className="text-xs text-slate-500">Nenhum ficheiro carregado.</p>
                              )}
                              <input ref={fileRef} type="file" className="hidden"
                                accept={selectedConteudo.tipo === "VIDEO" ? "video/*,.mp4,.webm,.mov" : UPLOAD_ACCEPT}
                                onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadFicheiro(f, selectedConteudo.id); e.target.value = ""; }} />
                              <Button type="button" variant="secondary" size="sm" className="w-full sm:w-auto" disabled={busy} onClick={() => fileRef.current?.click()}>
                                <Upload className="h-3.5 w-3.5" />
                                {meta.fileName ? "Substituir ficheiro" : "Carregar ficheiro"}
                              </Button>
                            </div>
                          );
                        })()}
                      </>
                    ) : null}
                    {selectedConteudo.tipo === "QUIZ" ? (
                      <div className="space-y-3">
                        <label className="flex items-center gap-2 text-xs text-slate-400">
                          <input type="checkbox" checked={selectedConteudo.notaMinima != null}
                            onChange={(e) => {
                              const notaMinima = e.target.checked ? (selectedConteudo.notaMinima ?? 50) : null;
                              setModulos((p) => p.map((x) => x.id === selectedConteudo.id ? { ...x, notaMinima } : x));
                              void updateConteudo(selectedConteudo.id, { notaMinima });
                            }} />
                          Quiz com nota mínima
                        </label>
                        <QuizPerguntaEditor moduloId={selectedConteudo.id} canEdit={canEdit} />
                      </div>
                    ) : null}
                    <Button type="button" variant="danger" size="sm" className="w-full sm:w-auto" onClick={() => void deleteConteudo(selectedConteudo.id)}>
                      <Trash2 className="h-3.5 w-3.5" />Eliminar conteúdo
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
                  <Pencil className="h-10 w-10 text-slate-600 mb-3" />
                  <p className="text-sm text-slate-400">Selecciona um conteúdo na lista para editar.</p>
                </div>
              )
            ) : (
                <div className="flex flex-1 items-center justify-center p-8 text-sm text-slate-500">
                  Sem permissão para editar conteúdos.
                </div>
              )}
            </div>

            <div className="flex min-h-0 w-80 xl:w-96 shrink-0 flex-col overflow-hidden bg-slate-950/50">
              <div className="shrink-0 px-3 py-2 border-b border-slate-700/40 bg-slate-900/50 flex items-center justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Mockup · ao vivo
                </p>
                <span className="text-[9px] text-teal-500/80">formando</span>
              </div>
              <div className="min-h-0 flex-1 overflow-hidden">
                <FormandoPortalMockup {...mockupProps} className="h-full rounded-none" />
              </div>
            </div>
          </div>
        </div>

        {/* Mobile: mockup ou editor abaixo da lista */}
        <div className="lg:hidden shrink-0 border-t border-slate-700/30 overflow-hidden">
          {rightPanel === "preview" ? (
            <div className="h-[min(40vh,340px)]">
              <FormandoPortalMockup {...mockupProps} className="h-full" />
            </div>
          ) : selectedConteudo && canEdit ? (
            <div className="max-h-[min(50vh,420px)] overflow-y-auto p-4 space-y-3 border-t border-slate-700/30 bg-slate-950/60">
              <h3 className="text-sm font-semibold text-slate-200">Editar conteúdo</h3>
              <label className="block">
                <span className="text-xs text-slate-400 mb-1 block">Título</span>
                <input className={inputClass} value={selectedConteudo.titulo}
                  onChange={(e) => setModulos((p) => p.map((x) => x.id === selectedConteudo.id ? { ...x, titulo: e.target.value } : x))}
                  onBlur={() => void updateConteudo(selectedConteudo.id, { titulo: selectedConteudo.titulo })} />
              </label>
              {selectedConteudo.tipo === "QUIZ" ? (
                <QuizPerguntaEditor moduloId={selectedConteudo.id} canEdit={canEdit} />
              ) : null}
            </div>
          ) : (
            <div className="h-[min(28vh,240px)]">
              <FormandoPortalMockup {...mockupProps} className="h-full" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
