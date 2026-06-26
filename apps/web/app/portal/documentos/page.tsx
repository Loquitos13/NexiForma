"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { useTenantRole } from "@/lib/client/use-tenant-role";

type Documento = {
  id: string;
  nomeFicheiro: string;
  mimeType: string;
  tamanhoBytes: number;
  createdAt: string;
  createdBy?: { email: string; displayName: string | null };
  entidadeCliente?: { nome: string } | null;
  acaoFormacao?: { codigoInterno: string } | null;
};

type EntidadeOpt = { id: string; nome: string };
type AcaoOpt = { id: string; codigoInterno: string; titulo: string };

const selectClass = "w-full px-3 py-2 rounded-lg bg-slate-900/80 border border-slate-700/60 text-sm text-slate-200 outline-none focus:border-blue-500/40 transition-colors";

export default function DocumentosPage() {
  const { canManage } = useTenantRole();
  const [docs, setDocs] = useState<Documento[]>([]);
  const [entidades, setEntidades] = useState<EntidadeOpt[]>([]);
  const [acoes, setAcoes] = useState<AcaoOpt[]>([]);
  const [entidadeId, setEntidadeId] = useState("");
  const [acaoId, setAcaoId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void bffFetch("/api/v1/entidades-cliente", { headers: { accept: "application/json" } }).then(async (r) => {
      if (r.ok) setEntidades((await r.json()) as EntidadeOpt[]);
    });
    void bffFetch("/api/v1/acoes-formacao", { headers: { accept: "application/json" } }).then(async (r) => {
      if (r.ok) setAcoes((await r.json()) as AcaoOpt[]);
    });
  }, []);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (entidadeId) params.set("entidadeClienteId", entidadeId);
    if (acaoId) params.set("acaoFormacaoId", acaoId);
    const r = await bffFetch(`/api/v1/documentos?${params}`, { headers: { accept: "application/json" } });
    if (r.ok) setDocs((await r.json()) as Documento[]);
  }, [entidadeId, acaoId]);

  useEffect(() => { void load(); }, [load]);

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !canManage) return;
    setBusy(true); setError(null); setMsg(null);
    const form = new FormData();
    form.append("file", file);
    if (entidadeId) form.append("entidadeClienteId", entidadeId);
    if (acaoId) form.append("acaoFormacaoId", acaoId);
    const r = await bffFetch("/api/v1/documentos/upload", { method: "POST", body: form });
    setBusy(false);
    if (!r.ok) { setError("Erro ao carregar documento."); return; }
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
    setMsg("Documento carregado.");
    await load();
  }

  async function download(docId: string) {
    const r = await bffFetch(`/api/v1/documentos/${docId}/download-url`, { headers: { accept: "application/json" } });
    if (!r.ok) { setError("Erro ao obter URL."); return; }
    const data = (await r.json()) as { url: string };
    window.open(data.url, "_blank", "noopener,noreferrer");
  }

  function formatBytes(n: number) {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div className="max-w-5xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-50">Documentos partilhados</h1>
        <p className="text-sm text-slate-500 mt-1">Repositorio de documentos para partilhar com formandos, entidades e accoes.</p>
      </div>

      {error ? <div className="flex items-start gap-2.5 rounded-xl bg-red-950/40 border border-red-500/25 px-4 py-3"><p className="text-sm text-red-300">{error}</p></div> : null}
      {msg ? <div className="flex items-start gap-2.5 rounded-xl bg-green-950/30 border border-green-500/25 px-4 py-3"><p className="text-sm text-green-300">{msg}</p></div> : null}

      {/* Filters + Upload */}
      <div className="rounded-2xl bg-slate-900/50 border border-slate-700/30 p-5 space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">Entidade (opcional)</label>
            <select value={entidadeId} onChange={(e) => setEntidadeId(e.target.value)} className={selectClass}>
              <option value="">Todas</option>
              {entidades.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">Accao (opcional)</label>
            <select value={acaoId} onChange={(e) => setAcaoId(e.target.value)} className={selectClass}>
              <option value="">Todas</option>
              {acoes.map((a) => <option key={a.id} value={a.id}>{a.codigoInterno} – {a.titulo}</option>)}
            </select>
          </div>
        </div>

        {canManage ? (
          <form onSubmit={(e) => void upload(e)} className="flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-400 mb-1.5">Carregar ficheiro</label>
              <input ref={fileRef} type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700/60 text-sm text-slate-200 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-blue-600 file:text-white hover:file:bg-blue-500" />
            </div>
            <button type="submit" disabled={busy || !file}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium transition-colors flex-shrink-0">
              {busy ? "A carregar..." : "Upload"}
            </button>
          </form>
        ) : null}
      </div>

      {/* Documents list */}
      <div className="rounded-2xl bg-slate-900/50 border border-slate-700/30 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-700/30">
          <h2 className="text-sm font-semibold text-slate-200">Documentos ({docs.length})</h2>
        </div>
        {docs.length === 0 ? (
          <div className="p-8 text-center">
            <svg className="w-10 h-10 text-slate-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            <p className="text-sm text-slate-500">Sem documentos.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700/30">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Ficheiro</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Associado a</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Tamanho</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Data</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/20">
              {docs.map((d) => (
                <tr key={d.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-slate-200 font-medium text-xs">{d.nomeFicheiro}</p>
                    <p className="text-[10px] text-slate-600">{d.mimeType}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400 hidden sm:table-cell">
                    {d.entidadeCliente?.nome ?? d.acaoFormacao?.codigoInterno ?? "–"}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 hidden md:table-cell">{formatBytes(d.tamanhoBytes)}</td>
                  <td className="px-4 py-3 text-xs text-slate-500 hidden md:table-cell">{new Date(d.createdAt).toLocaleDateString("pt-PT")}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => void download(d.id)}
                      className="px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-500 text-[11px] font-medium text-white transition-colors">Download</button>
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
