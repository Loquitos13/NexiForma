"use client";

import { useCallback, useEffect, useState } from "react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { useTenantRole } from "@/lib/client/use-tenant-role";

type CursoOpt = { id: string; designacao: string; codigoUfcd: string };
type ModuloRow = { id: string; titulo: string; tipo: string; ordem: number; publicado: boolean; urlOuRef: string | null; duracaoMin: number | null };

const TIPOS = ["VIDEO", "PDF", "TEXTO", "QUIZ", "SCORM"] as const;
const inputClass = "w-full px-3 py-2 rounded-lg bg-slate-900/80 border border-slate-700/60 text-sm text-slate-200 placeholder:text-slate-500 outline-none focus:border-blue-500/40 transition-colors";
const selectClass = "w-full max-w-sm px-3 py-2 rounded-lg bg-slate-900/80 border border-slate-700/60 text-sm text-slate-200 outline-none focus:border-blue-500/40 transition-colors";

const tipoBadge: Record<string, string> = {
  VIDEO: "bg-blue-500/10 text-blue-400",
  PDF: "bg-red-500/10 text-red-400",
  TEXTO: "bg-slate-500/10 text-slate-400",
  QUIZ: "bg-purple-500/10 text-purple-400",
  SCORM: "bg-teal-500/10 text-teal-400",
};

export default function ConteudosPage() {
  const { canManage } = useTenantRole();
  const [cursos, setCursos] = useState<CursoOpt[]>([]);
  const [cursoId, setCursoId] = useState("");
  const [modulos, setModulos] = useState<ModuloRow[]>([]);
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState<(typeof TIPOS)[number]>("TEXTO");
  const [urlOuRef, setUrlOuRef] = useState("");
  const [conteudoHtml, setConteudoHtml] = useState("");
  const [scormTitulo, setScormTitulo] = useState("");
  const [scormFile, setScormFile] = useState<File | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void bffFetch("/api/v1/cursos", { headers: { accept: "application/json" } }).then(async (r) => {
      if (!r.ok) return;
      const rows = (await r.json()) as CursoOpt[];
      setCursos(rows);
      if (rows.length) setCursoId(rows[0].id);
    });
  }, []);

  const loadModulos = useCallback(async (id: string) => {
    if (!id) return setModulos([]);
    const r = await bffFetch(`/api/v1/conteudos-lms/modulos?cursoId=${encodeURIComponent(id)}`, { headers: { accept: "application/json" } });
    if (!r.ok) { setError("Erro ao carregar modulos."); return; }
    setModulos((await r.json()) as ModuloRow[]);
  }, []);

  useEffect(() => { void loadModulos(cursoId); }, [cursoId, loadModulos]);

  async function criarModulo(e: React.FormEvent) {
    e.preventDefault();
    if (!canManage || !cursoId || !titulo.trim()) return;
    setBusy(true); setError(null); setMsg(null);
    const r = await bffFetch("/api/v1/conteudos-lms/modulos", {
      method: "POST", headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({ cursoId, titulo: titulo.trim(), tipo, ordem: modulos.length, urlOuRef: urlOuRef.trim() || undefined, conteudoHtml: conteudoHtml.trim() || undefined, publicado: true }),
    });
    setBusy(false);
    if (!r.ok) { setError("Erro ao criar modulo."); return; }
    setTitulo(""); setUrlOuRef(""); setConteudoHtml(""); setMsg("Modulo criado.");
    await loadModulos(cursoId);
  }

  async function uploadScorm(e: React.FormEvent) {
    e.preventDefault();
    if (!canManage || !cursoId || !scormTitulo.trim() || !scormFile) return;
    setBusy(true); setError(null); setMsg(null);
    const form = new FormData();
    form.append("cursoId", cursoId); form.append("titulo", scormTitulo.trim()); form.append("package", scormFile);
    const r = await bffFetch("/api/v1/conteudos-lms/scorm/upload", { method: "POST", body: form });
    setBusy(false);
    if (!r.ok) { setError("Erro ao carregar SCORM."); return; }
    setScormTitulo(""); setScormFile(null); setMsg("Pacote SCORM carregado e publicado.");
    await loadModulos(cursoId);
  }

  return (
    <div className="max-w-4xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-50">Conteudos LMS</h1>
        <p className="text-sm text-slate-500 mt-1">Modulos por curso – video, PDF, texto, quiz ou pacote SCORM alojado (S3/local).</p>
      </div>

      {error ? <div className="flex items-start gap-2.5 rounded-xl bg-red-950/40 border border-red-500/25 px-4 py-3"><p className="text-sm text-red-300">{error}</p></div> : null}
      {msg ? <div className="flex items-start gap-2.5 rounded-xl bg-green-950/30 border border-green-500/25 px-4 py-3"><p className="text-sm text-green-300">{msg}</p></div> : null}

      {/* Course selector */}
      <div className="rounded-2xl bg-slate-900/50 border border-slate-700/30 p-5">
        <label className="block text-sm font-medium text-slate-400 mb-1.5">Curso</label>
        <select value={cursoId} onChange={(e) => setCursoId(e.target.value)} className={selectClass}>
          {cursos.map((c) => <option key={c.id} value={c.id}>{c.codigoUfcd} – {c.designacao}</option>)}
        </select>
      </div>

      {/* Modules table */}
      <div className="rounded-2xl bg-slate-900/50 border border-slate-700/30 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-700/30">
          <h2 className="text-sm font-semibold text-slate-200">Modulos ({modulos.length})</h2>
        </div>
        {modulos.length === 0 ? (
          <div className="p-5 text-sm text-slate-500">Sem modulos neste curso.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700/30">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">#</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Titulo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tipo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/20">
              {modulos.map((m) => (
                <tr key={m.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-3 text-slate-500">{m.ordem}</td>
                  <td className="px-4 py-3 text-slate-200 font-medium">{m.titulo}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${tipoBadge[m.tipo] ?? tipoBadge.TEXTO}`}>{m.tipo}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${m.publicado ? "bg-green-500/10 text-green-400" : "bg-yellow-500/10 text-yellow-400"}`}>
                      {m.publicado ? "Publicado" : "Rascunho"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* SCORM upload */}
      {canManage ? (
        <div className="rounded-2xl bg-slate-900/50 border border-slate-700/30 p-5">
          <h2 className="text-sm font-semibold text-slate-200 mb-1">Carregar pacote SCORM (.zip)</h2>
          <p className="text-xs text-slate-500 mb-4">Extrai o ZIP para storage, detecta o imsmanifest.xml e publica o modulo.</p>
          <form onSubmit={(e) => void uploadScorm(e)} className="space-y-3 max-w-md">
            <input placeholder="Titulo do modulo SCORM" value={scormTitulo} onChange={(e) => setScormTitulo(e.target.value)} className={inputClass} required />
            <input type="file" accept=".zip,application/zip" onChange={(e) => setScormFile(e.target.files?.[0] ?? null)} className={inputClass} required />
            <button type="submit" disabled={busy}
              className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-sm font-medium transition-colors">{busy ? "A carregar..." : "Upload SCORM"}</button>
          </form>
        </div>
      ) : null}

      {/* New module */}
      {canManage ? (
        <div className="rounded-2xl bg-slate-900/50 border border-slate-700/30 p-5">
          <h2 className="text-sm font-semibold text-slate-200 mb-3">Novo modulo</h2>
          <form onSubmit={(e) => void criarModulo(e)} className="space-y-3 max-w-md">
            <input placeholder="Titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} className={inputClass} required />
            <select value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)} className={selectClass}>
              {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <input placeholder="URL ou referencia (opcional)" value={urlOuRef} onChange={(e) => setUrlOuRef(e.target.value)} className={inputClass} />
            <textarea placeholder="Conteudo HTML (opcional, para TEXTO)" value={conteudoHtml} onChange={(e) => setConteudoHtml(e.target.value)} rows={4} className={`${inputClass} resize-y`} />
            <button type="submit" disabled={busy}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium transition-colors">{busy ? "A guardar..." : "Criar modulo"}</button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
