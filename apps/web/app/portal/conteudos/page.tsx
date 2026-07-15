"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { validarModuloConteudoCompleto } from "@nexiforma/shared";
import { bffFetch } from "@/lib/client/bff-fetch";
import { parseApiError } from "@/lib/ui/backoffice";
import { useTenantRole } from "@/lib/client/use-tenant-role";

type CursoOpt = { id: string; designacao: string; codigoUfcd: string };
type ModuloRow = {
  id: string;
  titulo: string;
  tipo: string;
  ordem: number;
  publicado: boolean;
  urlOuRef: string | null;
  duracaoMin: number | null;
};

const TIPOS = ["VIDEO", "PDF", "TEXTO", "QUIZ", "SCORM"] as const;
const inputClass =
  "w-full px-3 py-2 rounded-lg bg-slate-900/80 border border-slate-700/60 text-sm text-slate-200 placeholder:text-slate-500 outline-none focus:border-blue-500/40 transition-colors";
const selectClass =
  "w-full px-3 py-2 rounded-lg bg-slate-900/80 border border-slate-700/60 text-sm text-slate-200 outline-none focus:border-blue-500/40 transition-colors";

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
  const [addOpen, setAddOpen] = useState(false);
  const [addMode, setAddMode] = useState<"manual" | "scorm">("manual");
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
      if (rows.length) setCursoId(rows[0]!.id);
    });
  }, []);

  const loadModulos = useCallback(async (id: string) => {
    if (!id) return setModulos([]);
    const r = await bffFetch(`/api/v1/conteudos-lms/modulos?cursoId=${encodeURIComponent(id)}`, {
      headers: { accept: "application/json" },
    });
    if (!r.ok) {
      setError("Erro ao carregar modulos.");
      return;
    }
    setModulos((await r.json()) as ModuloRow[]);
  }, []);

  useEffect(() => {
    void loadModulos(cursoId);
  }, [cursoId, loadModulos]);

  function resetAddForm() {
    setTitulo("");
    setUrlOuRef("");
    setConteudoHtml("");
    setScormTitulo("");
    setScormFile(null);
    setTipo("TEXTO");
    setAddMode("manual");
  }

  function closeAdd() {
    setAddOpen(false);
    resetAddForm();
  }

  async function criarModulo(e: React.FormEvent) {
    e.preventDefault();
    if (!canManage || !cursoId || !titulo.trim()) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    const draft = {
      tipo,
      urlOuRef: urlOuRef.trim() || null,
      conteudoHtml: conteudoHtml.trim() || null,
    };
    const check = validarModuloConteudoCompleto(draft);
    const r = await bffFetch("/api/v1/conteudos-lms/modulos", {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        cursoId,
        titulo: titulo.trim(),
        tipo,
        ordem: modulos.length,
        urlOuRef: draft.urlOuRef || undefined,
        conteudoHtml: draft.conteudoHtml || undefined,
        publicado: check.ok,
      }),
    });
    setBusy(false);
    if (!r.ok) {
      setError(await parseApiError(r));
      return;
    }
    setMsg("Modulo criado.");
    closeAdd();
    await loadModulos(cursoId);
  }

  async function uploadScorm(e: React.FormEvent) {
    e.preventDefault();
    if (!canManage || !cursoId || !scormTitulo.trim() || !scormFile) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    const form = new FormData();
    form.append("cursoId", cursoId);
    form.append("titulo", scormTitulo.trim());
    form.append("package", scormFile);
    const r = await bffFetch("/api/v1/conteudos-lms/scorm/upload", { method: "POST", body: form });
    setBusy(false);
    if (!r.ok) {
      setError("Erro ao carregar SCORM.");
      return;
    }
    setMsg("Pacote SCORM carregado e publicado.");
    closeAdd();
    await loadModulos(cursoId);
  }

  return (
    <div className="max-w-4xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-50">Conteudos LMS</h1>
        <p className="text-sm text-slate-500 mt-1">
          Modulos por curso – video, PDF, texto, quiz ou pacote SCORM.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl bg-red-950/40 border border-red-500/25 px-4 py-3">
          <p className="text-sm text-red-300">{error}</p>
        </div>
      ) : null}
      {msg ? (
        <div className="rounded-xl bg-green-950/30 border border-green-500/25 px-4 py-3">
          <p className="text-sm text-green-300">{msg}</p>
        </div>
      ) : null}

      <div className="rounded-2xl bg-slate-900/50 border border-slate-700/30 p-5">
        <label className="block text-sm font-medium text-slate-400 mb-1.5">Curso</label>
        <select
          value={cursoId}
          onChange={(e) => {
            setCursoId(e.target.value);
            closeAdd();
          }}
          className={selectClass}
        >
          {cursos.map((c) => (
            <option key={c.id} value={c.id}>
              {c.codigoUfcd} – {c.designacao}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-2xl bg-slate-900/50 border border-slate-700/30 overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-700/30">
          <h2 className="text-sm font-semibold text-slate-200">Modulos ({modulos.length})</h2>
          {canManage ? (
            <button
              type="button"
              onClick={() => {
                if (addOpen) closeAdd();
                else setAddOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors"
            >
              {addOpen ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
              {addOpen ? "Cancelar" : "Adicionar modulo"}
            </button>
          ) : null}
        </div>

        {addOpen && canManage ? (
          <div className="border-b border-slate-700/30 bg-slate-800/20 px-5 py-4">
            <div className="flex gap-2 mb-4">
              <button
                type="button"
                onClick={() => setAddMode("manual")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  addMode === "manual"
                    ? "bg-blue-600 text-white"
                    : "bg-slate-800 text-slate-400 hover:text-slate-200"
                }`}
              >
                Conteudo manual
              </button>
              <button
                type="button"
                onClick={() => setAddMode("scorm")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  addMode === "scorm"
                    ? "bg-teal-600 text-white"
                    : "bg-slate-800 text-slate-400 hover:text-slate-200"
                }`}
              >
                Pacote SCORM
              </button>
            </div>

            {addMode === "manual" ? (
              <form onSubmit={(e) => void criarModulo(e)} className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="block text-xs text-slate-500 mb-1">Titulo *</label>
                  <input
                    placeholder="Nome do modulo"
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                    className={inputClass}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Tipo</label>
                  <select
                    value={tipo}
                    onChange={(e) => setTipo(e.target.value as typeof tipo)}
                    className={selectClass}
                  >
                    {TIPOS.filter((t) => t !== "SCORM").map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">URL ou referencia</label>
                  <input
                    placeholder="Opcional"
                    value={urlOuRef}
                    onChange={(e) => setUrlOuRef(e.target.value)}
                    className={inputClass}
                  />
                </div>
                {tipo === "TEXTO" ? (
                  <div className="sm:col-span-2">
                    <label className="block text-xs text-slate-500 mb-1">Conteudo HTML</label>
                    <textarea
                      placeholder="Opcional"
                      value={conteudoHtml}
                      onChange={(e) => setConteudoHtml(e.target.value)}
                      rows={3}
                      className={`${inputClass} resize-y`}
                    />
                  </div>
                ) : null}
                <div className="sm:col-span-2 flex gap-2">
                  <button
                    type="submit"
                    disabled={busy}
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium"
                  >
                    {busy ? "A guardar..." : "Criar modulo"}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={(e) => void uploadScorm(e)} className="grid gap-3 max-w-lg">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Titulo *</label>
                  <input
                    placeholder="Titulo do modulo SCORM"
                    value={scormTitulo}
                    onChange={(e) => setScormTitulo(e.target.value)}
                    className={inputClass}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Ficheiro .zip *</label>
                  <input
                    type="file"
                    accept=".zip,application/zip"
                    onChange={(e) => setScormFile(e.target.files?.[0] ?? null)}
                    className={inputClass}
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="w-fit px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-sm font-medium"
                >
                  {busy ? "A carregar..." : "Carregar SCORM"}
                </button>
              </form>
            )}
          </div>
        ) : null}

        {modulos.length === 0 ? (
          <div className="p-5 text-sm text-slate-500">
            Sem modulos neste curso.
            {canManage ? " Clica em «Adicionar modulo» para criar o primeiro." : null}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700/30">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  #
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Titulo
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Tipo
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Estado
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/20">
              {modulos.map((m) => (
                <tr key={m.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-3 text-slate-500">{m.ordem}</td>
                  <td className="px-4 py-3 text-slate-200 font-medium">{m.titulo}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${tipoBadge[m.tipo] ?? tipoBadge.TEXTO}`}
                    >
                      {m.tipo}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${m.publicado ? "bg-green-500/10 text-green-400" : "bg-yellow-500/10 text-yellow-400"}`}
                    >
                      {m.publicado ? "Publicado" : "Rascunho"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
