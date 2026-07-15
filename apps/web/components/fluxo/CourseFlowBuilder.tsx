"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Upload } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { parseApiError } from "@/lib/ui/backoffice";
import { Button } from "@/components/ui";
import { ModuloStoredMedia } from "@/components/lms/ModuloStoredMedia";
import { QuizPerguntaEditor } from "@/components/portal/QuizPerguntaEditor";
import { isModuloStorageRef, validarModuloConteudoCompleto } from "@nexiforma/shared";

// ── Types ──

type CursoOpt = { id: string; designacao: string; codigoUfcd: string; cargaHoras: number };
type ModuloNode = {
  id: string;
  titulo: string;
  tipo: "VIDEO" | "PDF" | "TEXTO" | "QUIZ" | "SCORM";
  ordem: number;
  duracaoMin: number | null;
  urlOuRef: string | null;
  conteudoHtml: string | null;
  notaMinima: number | null;
  prerequisitoModuloId: string | null;
  publicado: boolean;
  metadata?: Record<string, unknown> | null;
};

const UPLOAD_ACCEPT =
  "video/*,.mp4,.webm,.mov,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.odt,.odp,.csv,.rtf,image/*";

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

const inputClass =
  "w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700/60 text-sm text-slate-200 outline-none focus:border-blue-500/40 transition-colors";

function tipoLabel(tipo: ModuloNode["tipo"]): string {
  return TIPOS_MODULO.find((t) => t.tipo === tipo)?.label ?? tipo;
}

type DragState = { fromIdx: number } | null;

// ── Constants ──

const TIPOS_MODULO = [
  { tipo: "VIDEO", label: "Video", icon: "M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z", color: "blue" },
  { tipo: "PDF", label: "Documento", icon: "M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z", color: "red" },
  { tipo: "TEXTO", label: "Texto", icon: "M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z", color: "slate" },
  { tipo: "QUIZ", label: "Quiz", icon: "M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z", color: "purple" },
  { tipo: "SCORM", label: "SCORM", icon: "M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25", color: "teal" },
] as const;

const colorMap: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  blue: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/30", dot: "bg-blue-400" },
  red: { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/30", dot: "bg-red-400" },
  slate: { bg: "bg-slate-500/10", text: "text-slate-400", border: "border-slate-500/30", dot: "bg-slate-400" },
  purple: { bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/30", dot: "bg-purple-400" },
  teal: { bg: "bg-teal-500/10", text: "text-teal-400", border: "border-teal-500/30", dot: "bg-teal-400" },
};

// ── Main Component ──

export default function CourseFlowBuilder() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const cursoIdFromUrl = searchParams.get("cursoId") ?? "";

  const [cursos, setCursos] = useState<CursoOpt[]>([]);
  const [cursoId, setCursoId] = useState("");
  const [modulos, setModulos] = useState<ModuloNode[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [drag, setDrag] = useState<DragState>(null);
  const [dropIdx, setDropIdx] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [addTipo, setAddTipo] = useState<string>("TEXTO");
  const canvasRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const scormRef = useRef<HTMLInputElement>(null);

  function selectCurso(id: string) {
    setCursoId(id);
    setSelectedIdx(null);
    const q = new URLSearchParams(searchParams.toString());
    q.set("v", "conteudos");
    if (id) q.set("cursoId", id);
    else q.delete("cursoId");
    router.replace(`/portal/fluxo?${q.toString()}`);
  }

  // Load courses
  useEffect(() => {
    void bffFetch("/api/v1/cursos", { headers: { accept: "application/json" } }).then(async (r) => {
      if (!r.ok) return;
      const rows = (await r.json()) as CursoOpt[];
      setCursos(rows);
      if (!rows.length) return;
      const pick =
        cursoIdFromUrl && rows.some((row) => row.id === cursoIdFromUrl)
          ? cursoIdFromUrl
          : rows[0].id;
      setCursoId(pick);
    });
  }, [cursoIdFromUrl]);

  // Load modules for selected course
  const loadModulos = useCallback(async (id: string) => {
    if (!id) { setModulos([]); return; }
    const r = await bffFetch(`/api/v1/conteudos-lms/modulos?cursoId=${encodeURIComponent(id)}`, { headers: { accept: "application/json" } });
    if (r.ok) setModulos((await r.json()) as ModuloNode[]);
  }, []);

  useEffect(() => { void loadModulos(cursoId); }, [cursoId, loadModulos]);

  // Add module (rascunho — conteúdo e publicação na barra lateral)
  async function adicionarModulo(tipo: string = addTipo) {
    if (!cursoId) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    const r = await bffFetch("/api/v1/conteudos-lms/modulos", {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        cursoId,
        titulo: `Novo ${tipo}`,
        tipo,
        ordem: modulos.length,
        publicado: false,
      }),
    });
    setBusy(false);
    if (!r.ok) {
      setError(await parseApiError(r));
      return;
    }
    const created = (await r.json()) as ModuloNode;
    setModulos((prev) => {
      const next = [...prev, created];
      setSelectedIdx(next.length - 1);
      return next;
    });
    setMsg("Etapa criada. Carrega o ficheiro ou indica um URL na barra lateral.");
  }

  async function uploadFicheiro(file: File, moduloId: string) {
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
    const updated = (await r.json()) as ModuloNode;
    setModulos((prev) => prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)));
    setMsg(
      updated.publicado
        ? `«${file.name}» carregado e publicado — visível para formandos.`
        : `«${file.name}» carregado — completa e publica para os formandos verem.`,
    );
  }

  async function uploadScormPackage(file: File, idx: number) {
    const m = modulos[idx];
    if (!m || !cursoId) return;
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.append("package", file);
    fd.append("cursoId", cursoId);
    fd.append("titulo", m.titulo.trim() || "Pacote SCORM");
    const r = await bffFetch("/api/v1/conteudos-lms/scorm/upload", { method: "POST", body: fd });
    if (!r.ok) {
      setBusy(false);
      setError(await parseApiError(r));
      return;
    }
    const created = (await r.json()) as ModuloNode;
    if (m.id !== created.id) {
      await bffFetch(`/api/v1/conteudos-lms/modulos/${m.id}`, { method: "DELETE" });
    }
    await bffFetch(`/api/v1/conteudos-lms/modulos/${created.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        ordem: m.ordem,
        prerequisitoModuloId: m.prerequisitoModuloId,
        publicado: m.publicado,
      }),
    });
    setBusy(false);
    const listRes = await bffFetch(
      `/api/v1/conteudos-lms/modulos?cursoId=${encodeURIComponent(cursoId)}`,
      { headers: { accept: "application/json" } },
    );
    if (listRes.ok) {
      const list = (await listRes.json()) as ModuloNode[];
      setModulos(list);
      const newIdx = list.findIndex((x) => x.id === created.id);
      if (newIdx >= 0) setSelectedIdx(newIdx);
    }
    setMsg(`Pacote SCORM «${file.name}» carregado.`);
  }

  // Update module
  async function updateModulo(idx: number, data: Partial<ModuloNode>) {
    const m = modulos[idx];
    if (!m) return;

    const merged = { ...m, ...data };
    const check = validarModuloConteudoCompleto(merged);
    const payload: Partial<ModuloNode> = { ...data };

    if (data.publicado === undefined) {
      const contentChanged =
        data.urlOuRef !== undefined ||
        data.conteudoHtml !== undefined ||
        data.notaMinima !== undefined;
      if (contentChanged) {
        payload.publicado = check.ok;
      }
    }

    setBusy(true);
    setError(null);
    const r = await bffFetch(`/api/v1/conteudos-lms/modulos/${m.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (!r.ok) {
      setError(await parseApiError(r));
      if (data.publicado === true) {
        setModulos((prev) => prev.map((x, i) => (i === idx ? { ...x, publicado: false } : x)));
      }
      return;
    }
    const updated = (await r.json()) as ModuloNode;
    setModulos((prev) => prev.map((x, i) => (i === idx ? { ...x, ...updated } : x)));
    if (updated.publicado) {
      setMsg("Guardado e publicado — visível para formandos.");
    } else if (check.ok && data.publicado === undefined) {
      setMsg("Guardado como rascunho.");
    } else if (!check.ok && data.publicado === undefined) {
      setMsg("Guardado como rascunho — completa o conteúdo para publicar.");
    } else {
      setMsg("Guardado como rascunho.");
    }
  }

  // Delete module
  async function deleteModulo(idx: number) {
    const m = modulos[idx];
    if (!m || !confirm(`Eliminar "${m.titulo}"?`)) return;
    setBusy(true); setError(null);
    const r = await bffFetch(`/api/v1/conteudos-lms/modulos/${m.id}`, { method: "DELETE" });
    setBusy(false);
    if (!r.ok) { setError("Erro ao eliminar."); return; }
    setSelectedIdx(null);
    await loadModulos(cursoId);
  }

  // Drag handlers
  function handleDragStart(idx: number) { setDrag({ fromIdx: idx }); }
  function handleDragOver(e: React.DragEvent, idx: number) { e.preventDefault(); setDropIdx(idx); }
  function handleDragLeave() { setDropIdx(null); }

  async function handleDrop(idx: number) {
    setDropIdx(null);
    if (!drag) return;
    const { fromIdx } = drag;
    setDrag(null);
    if (fromIdx === idx) return;

    const reordered = [...modulos];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(idx, 0, moved);
    setModulos(reordered);

    // Persist order
    for (let i = 0; i < reordered.length; i++) {
      if (reordered[i].ordem !== i) {
        await bffFetch(`/api/v1/conteudos-lms/modulos/${reordered[i].id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", accept: "application/json" },
          body: JSON.stringify({ ordem: i }),
        });
      }
    }
  }

  function getColor(tipo: string) {
    const found = TIPOS_MODULO.find((t) => t.tipo === tipo);
    return colorMap[found?.color ?? "slate"];
  }

  const selected = selectedIdx !== null ? modulos[selectedIdx] : null;
  const selectedContentCheck = selected ? validarModuloConteudoCompleto(selected) : null;
  const publicadosCount = modulos.filter((m) => m.publicado).length;
  const rascunhosCount = modulos.length - publicadosCount;

  return (
    <div className="flex h-[calc(100vh-10rem)] gap-0">
      {/* Left: Palette */}
      <aside className="w-56 flex-shrink-0 border-r border-slate-700/30 p-4 space-y-4 overflow-y-auto bg-slate-950/60">
        <div>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Curso</h3>
          <select
            value={cursoId}
            onChange={(e) => selectCurso(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700/60 text-sm text-slate-200 outline-none focus:border-blue-500/40 transition-colors"
          >
            {cursos.map((c) => (
              <option key={c.id} value={c.id}>{c.codigoUfcd} – {c.designacao}</option>
            ))}
          </select>
          {cursos.find((c) => c.id === cursoId) ? (
            <p className="text-[10px] text-slate-600 mt-1">
              {cursos.find((c) => c.id === cursoId)?.cargaHoras}h · partilhado por todas as acções deste curso
            </p>
          ) : null}
        </div>

        <div>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Adicionar etapa</h3>
          <div className="space-y-1.5 mb-3">
            {TIPOS_MODULO.map((t) => (
              <button
                key={t.tipo}
                type="button"
                onClick={() => { setAddTipo(t.tipo); void adicionarModulo(t.tipo); }}
                disabled={busy || !cursoId}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 ${addTipo === t.tipo ? colorMap[t.color].bg + " " + colorMap[t.color].border + " border" : "hover:bg-slate-800/40 text-slate-400"}`}
              >
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={t.icon} />
                </svg>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Info</h3>
          <p className="text-[11px] text-slate-600 leading-relaxed">
            Os conteúdos são guardados no curso e visíveis em todas as acções formativas do mesmo.
            Arrasta os modulos para reordenar. Clica num modulo para abrir a barra lateral e carregar ficheiros ou URLs.
            A publicação só fica disponível quando o conteúdo estiver completo.
          </p>
        </div>
      </aside>

      {/* Center: Canvas */}
      <div ref={canvasRef} className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto space-y-3">
          {error ? (
            <div className="flex items-start gap-2.5 rounded-xl bg-red-950/40 border border-red-500/25 px-4 py-3">
              <p className="text-sm text-red-300">{error}</p>
            </div>
          ) : null}
          {msg ? (
            <div className="flex items-start gap-2.5 rounded-xl bg-green-950/30 border border-green-500/25 px-4 py-3">
              <p className="text-sm text-green-300">{msg}</p>
            </div>
          ) : null}

          {cursoId && modulos.length > 0 ? (
            <div className="rounded-xl border border-slate-700/40 bg-slate-900/40 px-4 py-3 text-xs text-slate-400">
              <span className="text-slate-300 font-medium">{publicadosCount} publicado(s)</span>
              {rascunhosCount > 0 ? (
                <span> · {rascunhosCount} rascunho(s) — só os publicados aparecem no portal do formando</span>
              ) : (
                <span> · visíveis em todas as acções deste curso</span>
              )}
            </div>
          ) : null}

          {!cursoId ? (
            <div className="text-center py-20">
              <p className="text-slate-500 text-sm">Selecciona um curso para comecar.</p>
            </div>
          ) : modulos.length === 0 ? (
            <div className="text-center py-20">
              <svg className="w-16 h-16 text-slate-700 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={0.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
              </svg>
              <p className="text-slate-500 text-sm mb-2">Sem modulos neste curso.</p>
              <p className="text-slate-600 text-xs">Usa o painel esquerdo para adicionar etapas ao percurso.</p>
            </div>
          ) : (
            modulos.map((m, idx) => {
              const c = getColor(m.tipo);
              const isSelected = selectedIdx === idx;
              const isDropTarget = dropIdx === idx;
              const prereq = m.prerequisitoModuloId ? modulos.find((x) => x.id === m.prerequisitoModuloId) : null;
              const prereqIdx = prereq ? modulos.findIndex((x) => x.id === prereq.id) : -1;

              return (
                <div key={m.id} className="relative">
                  {/* Connection line from prerequisite */}
                  {prereq && prereqIdx >= 0 && prereqIdx < idx ? (
                    <div className="absolute left-6 -top-3 h-3 w-0.5 bg-slate-600" />
                  ) : null}

                  {/* Module card */}
                  <div
                    draggable
                    onDragStart={() => handleDragStart(idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDragLeave={handleDragLeave}
                    onDrop={() => void handleDrop(idx)}
                    onClick={() => setSelectedIdx(idx)}
                    className={`group relative rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? `${c.bg} ${c.border} ring-1 ring-blue-500/20`
                        : isDropTarget
                          ? "bg-slate-800/60 border-blue-500/30"
                          : "bg-slate-900/50 border-slate-700/30 hover:border-slate-600/40"
                    }`}
                  >
                    {/* Drag handle + order number */}
                    <div className="absolute left-0 top-0 bottom-0 flex items-center pl-3">
                      <div className="flex flex-col items-center gap-1">
                        <svg className="w-4 h-4 text-slate-600 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 6h.008M8 12h.008M8 18h.008M16 6h.008M16 12h.008M16 18h.008" />
                        </svg>
                        <span className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${c.bg} ${c.text}`}>
                          {idx + 1}
                        </span>
                      </div>
                    </div>

                    <div className="pl-14 pr-4 py-4">
                      <div className="flex items-center gap-2.5 mb-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium ${c.bg} ${c.text}`}>
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d={TIPOS_MODULO.find((t) => t.tipo === m.tipo)?.icon ?? TIPOS_MODULO[2].icon} />
                          </svg>
                          {m.tipo}
                        </span>
                        {m.duracaoMin ? (
                          <span className="text-[11px] text-slate-500">{m.duracaoMin} min</span>
                        ) : null}
                        {m.notaMinima ? (
                          <span className="text-[11px] text-yellow-500">Nota min: {m.notaMinima}%</span>
                        ) : null}
                        {!m.publicado ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-yellow-500/10 text-yellow-400">Rascunho</span>
                        ) : null}
                      </div>
                      <h3 className="text-sm font-semibold text-slate-100">{m.titulo || `Modulo ${idx + 1}`}</h3>
                      {prereq ? (
                        <p className="text-[11px] text-slate-600 mt-1.5 flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                          </svg>
                          Pre-requisito: {prereq.titulo || `Modulo ${prereqIdx + 1}`}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  {/* Connection dot (target handle) */}
                  {idx < modulos.length - 1 ? (
                    <div className="flex justify-center py-1.5">
                      <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" />
                      </svg>
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right: type-specific editor panel */}
      {selected && selectedIdx !== null ? (
        <aside className="w-96 flex-shrink-0 border-l border-slate-700/30 flex flex-col overflow-hidden bg-slate-950/60">
          <div className="shrink-0 px-4 py-3 border-b border-slate-700/40 flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-200">Editar etapa {selectedIdx + 1}</h3>
              <span
                className={`inline-flex mt-1 items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium ${getColor(selected.tipo).bg} ${getColor(selected.tipo).text}`}
              >
                {tipoLabel(selected.tipo)}
              </span>
            </div>
            <button
              type="button"
              onClick={() => void deleteModulo(selectedIdx)}
              className="px-2.5 py-1 rounded-lg text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors"
            >
              Eliminar
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
            <div className="space-y-3">
              <label className="block">
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1 block">
                  Título
                </span>
                <input
                  value={selected.titulo}
                  onChange={(e) => {
                    const v = e.target.value;
                    setModulos((prev) => prev.map((m, i) => (i === selectedIdx ? { ...m, titulo: v } : m)));
                  }}
                  onBlur={() => void updateModulo(selectedIdx, { titulo: selected.titulo })}
                  className={inputClass}
                />
              </label>

              <label className="block">
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1 block">
                  Duração (min)
                </span>
                <input
                  type="number"
                  min={0}
                  value={selected.duracaoMin ?? ""}
                  onChange={(e) => {
                    const v = e.target.value ? parseInt(e.target.value) : null;
                    setModulos((prev) => prev.map((m, i) => (i === selectedIdx ? { ...m, duracaoMin: v } : m)));
                  }}
                  onBlur={() => void updateModulo(selectedIdx, { duracaoMin: selected.duracaoMin })}
                  className={inputClass}
                />
              </label>

              <label className="block">
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1 block">
                  Pré-requisito
                </span>
                <select
                  value={selected.prerequisitoModuloId ?? ""}
                  onChange={(e) => {
                    const v = e.target.value || null;
                    setModulos((prev) =>
                      prev.map((m, i) => (i === selectedIdx ? { ...m, prerequisitoModuloId: v } : m)),
                    );
                    void updateModulo(selectedIdx, { prerequisitoModuloId: v });
                  }}
                  className={inputClass}
                >
                  <option value="">Nenhum</option>
                  {modulos
                    .filter((m, i) => i !== selectedIdx && i < selectedIdx)
                    .map((m, i) => (
                      <option key={m.id} value={m.id}>
                        {i + 1}. {m.titulo || `Modulo ${i + 1}`}
                      </option>
                    ))}
                </select>
              </label>
            </div>

            {/* ── Conteúdo por tipo ── */}
            {selected.tipo === "TEXTO" ? (
              <div className="rounded-lg border border-slate-700/40 bg-slate-900/50 p-3 space-y-2">
                <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Texto</p>
                <textarea
                  value={selected.conteudoHtml ?? ""}
                  onChange={(e) => {
                    const v = e.target.value || null;
                    setModulos((prev) =>
                      prev.map((m, i) => (i === selectedIdx ? { ...m, conteudoHtml: v } : m)),
                    );
                  }}
                  onBlur={() => void updateModulo(selectedIdx, { conteudoHtml: selected.conteudoHtml })}
                  rows={8}
                  placeholder="Escreve o conteúdo (HTML permitido)…"
                  className={`${inputClass} resize-y min-h-[120px]`}
                />
              </div>
            ) : null}

            {selected.tipo === "VIDEO" || selected.tipo === "PDF" ? (
              <div className="rounded-lg border border-slate-700/40 bg-slate-900/50 p-3 space-y-3">
                <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                  {selected.tipo === "VIDEO" ? "Vídeo" : "Documento"}
                </p>
                {(() => {
                  const meta = fileMeta(selected);
                  const isStored = isModuloStorageRef(selected.urlOuRef);
                  const externalUrl =
                    !isStored &&
                    (selected.urlOuRef?.startsWith("http://") || selected.urlOuRef?.startsWith("https://"))
                      ? selected.urlOuRef
                      : null;
                  const hasFile = isStored || !!externalUrl || !!meta.fileName;
                  return (
                    <>
                      {isStored && selected.urlOuRef ? (
                        <ModuloStoredMedia
                          moduloId={selected.id}
                          urlOuRef={selected.urlOuRef}
                          tipo={selected.tipo === "VIDEO" ? "VIDEO" : "PDF"}
                          mimeType={meta.mimeType}
                          fileName={meta.fileName}
                          variant="preview"
                          showActions
                        />
                      ) : null}
                      {!isStored && externalUrl && selected.tipo === "VIDEO" ? (
                        <video controls className="w-full rounded-lg max-h-40 bg-black" src={externalUrl} />
                      ) : null}
                      {!isStored && externalUrl && selected.tipo === "PDF" && meta.mimeType?.startsWith("image/") ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={externalUrl} alt={meta.fileName ?? "Documento"} className="max-h-40 rounded-lg mx-auto" />
                      ) : null}
                      {hasFile ? (
                        <div className="text-xs text-slate-400 space-y-1">
                          <p className="truncate">
                            <span className="text-slate-500">Ficheiro:</span> {meta.fileName ?? externalUrl}
                          </p>
                          {meta.sizeBytes ? (
                            <p>
                              <span className="text-slate-500">Tamanho:</span> {formatBytes(meta.sizeBytes)}
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500">
                          {selected.tipo === "VIDEO"
                            ? "Carrega um vídeo ou indica um URL externo (YouTube, Vimeo, etc.)."
                            : "Carrega um PDF, imagem ou documento."}
                        </p>
                      )}
                      <input
                        ref={fileRef}
                        type="file"
                        className="hidden"
                        accept={selected.tipo === "VIDEO" ? "video/*,.mp4,.webm,.mov" : UPLOAD_ACCEPT}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void uploadFicheiro(f, selected.id);
                          e.target.value = "";
                        }}
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="w-full"
                        disabled={busy}
                        onClick={() => fileRef.current?.click()}
                      >
                        <Upload className="h-3.5 w-3.5" />
                        {meta.fileName ? "Substituir ficheiro" : "Carregar ficheiro"}
                      </Button>
                      <label className="block">
                        <span className="text-[11px] text-slate-500 mb-1 block">URL externo (opcional)</span>
                        <input
                          value={
                            !isStored &&
                            selected.urlOuRef &&
                            !selected.urlOuRef.startsWith("storage:")
                              ? selected.urlOuRef
                              : ""
                          }
                          onChange={(e) => {
                            const v = e.target.value || null;
                            setModulos((prev) =>
                              prev.map((m, i) => (i === selectedIdx ? { ...m, urlOuRef: v } : m)),
                            );
                          }}
                          onBlur={() => void updateModulo(selectedIdx, { urlOuRef: selected.urlOuRef })}
                          placeholder="https://..."
                          className={inputClass}
                        />
                      </label>
                    </>
                  );
                })()}
              </div>
            ) : null}

            {selected.tipo === "QUIZ" ? (
              <div className="space-y-3">
                <div className="rounded-lg border border-purple-500/20 bg-purple-950/10 p-3 space-y-3">
                  <p className="text-[11px] font-medium text-purple-300 uppercase tracking-wider">Quiz</p>
                  <label className="flex items-center gap-2 text-xs text-slate-400">
                    <input
                      type="checkbox"
                      checked={selected.notaMinima != null}
                      onChange={(e) => {
                        const notaMinima = e.target.checked ? (selected.notaMinima ?? 50) : null;
                        setModulos((prev) =>
                          prev.map((m, i) => (i === selectedIdx ? { ...m, notaMinima } : m)),
                        );
                        void updateModulo(selectedIdx, { notaMinima });
                      }}
                      className="rounded border-slate-600 bg-slate-900 accent-purple-500"
                    />
                    Quiz com nota mínima para aprovação
                  </label>
                  {selected.notaMinima != null ? (
                    <label className="block">
                      <span className="text-[11px] text-slate-500 mb-1 block">Nota mínima (%)</span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={selected.notaMinima}
                        onChange={(e) => {
                          const v = parseInt(e.target.value) || 0;
                          setModulos((prev) =>
                            prev.map((m, i) => (i === selectedIdx ? { ...m, notaMinima: v } : m)),
                          );
                        }}
                        onBlur={() => void updateModulo(selectedIdx, { notaMinima: selected.notaMinima })}
                        className={inputClass}
                      />
                      <p className="text-[10px] text-slate-600 mt-1">
                        O formando precisa desta nota para concluir a etapa.
                      </p>
                    </label>
                  ) : null}
                </div>
                <QuizPerguntaEditor moduloId={selected.id} canEdit />
              </div>
            ) : null}

            {selected.tipo === "SCORM" ? (
              <div className="rounded-lg border border-teal-500/20 bg-teal-950/10 p-3 space-y-3">
                <p className="text-[11px] font-medium text-teal-300 uppercase tracking-wider">Pacote SCORM</p>
                {selected.urlOuRef ? (
                  <div className="text-xs text-slate-400 space-y-1">
                    <p>
                      <span className="text-slate-500">Versão:</span>{" "}
                      {typeof selected.metadata?.scormVersion === "string"
                        ? selected.metadata.scormVersion
                        : "SCORM"}
                    </p>
                    <p className="truncate">
                      <span className="text-slate-500">Pacote:</span>{" "}
                      {typeof selected.metadata?.launchFile === "string"
                        ? selected.metadata.launchFile
                        : "Carregado"}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">Carrega um ficheiro .zip com imsmanifest.xml.</p>
                )}
                <input
                  ref={scormRef}
                  type="file"
                  className="hidden"
                  accept=".zip,application/zip"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void uploadScormPackage(f, selectedIdx);
                    e.target.value = "";
                  }}
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="w-full"
                  disabled={busy}
                  onClick={() => scormRef.current?.click()}
                >
                  <Upload className="h-3.5 w-3.5" />
                  {selected.urlOuRef ? "Substituir pacote SCORM" : "Carregar pacote SCORM (.zip)"}
                </Button>
              </div>
            ) : null}

            <div className="pt-2 border-t border-slate-700/40">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.publicado}
                  disabled={!selectedContentCheck?.ok}
                  onChange={(e) => {
                    const v = e.target.checked;
                    setModulos((prev) =>
                      prev.map((m, i) => (i === selectedIdx ? { ...m, publicado: v } : m)),
                    );
                    void updateModulo(selectedIdx, { publicado: v });
                  }}
                  className="rounded border-slate-600 bg-slate-900 accent-blue-500 disabled:opacity-40"
                />
                <span className="text-sm text-slate-400">Publicado</span>
              </label>
              {selectedContentCheck && !selectedContentCheck.ok ? (
                <p className="text-[11px] text-slate-500 mt-1.5">{selectedContentCheck.message}</p>
              ) : null}
            </div>
          </div>
        </aside>
      ) : null}
    </div>
  );
}
