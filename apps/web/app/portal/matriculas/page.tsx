"use client";

import { useCallback, useEffect, useState } from "react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { useTenantRole } from "@/lib/client/use-tenant-role";

type AcaoOpt = { id: string; codigoInterno: string; titulo: string };
type TurmaOpt = { id: string; codigo: string; nome: string };
type FormandoOpt = { id: string; nome: string; nif: string; email: string };
type MatriculaRow = {
  id: string;
  estado: string;
  createdAt: string;
  formando: { id: string; nome: string; nif: string; email: string };
  turma: { id: string; codigo: string; nome: string; acaoFormacao: { codigoInterno: string; titulo: string } };
};

const estadoBadge: Record<string, string> = {
  ATIVA: "bg-green-500/10 text-green-400 border-green-500/20",
  DESISTENCIA: "bg-red-500/10 text-red-400 border-red-500/20",
  CONCLUSAO: "bg-teal-500/10 text-teal-400 border-teal-500/20",
};

const selectClass = "w-full px-3 py-2 rounded-lg bg-slate-900/80 border border-slate-700/60 text-sm text-slate-200 outline-none focus:border-blue-500/40 transition-colors";

export default function MatriculasPage() {
  const { canManage } = useTenantRole();
  const [acoes, setAcoes] = useState<AcaoOpt[]>([]);
  const [turmas, setTurmas] = useState<TurmaOpt[]>([]);
  const [formandos, setFormandos] = useState<FormandoOpt[]>([]);
  const [matriculas, setMatriculas] = useState<MatriculaRow[]>([]);
  const [acaoId, setAcaoId] = useState("");
  const [turmaId, setTurmaId] = useState("");
  const [formandoId, setFormandoId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void bffFetch("/api/v1/acoes-formacao", { headers: { accept: "application/json" } }).then(async (r) => {
      if (r.ok) { const rows = (await r.json()) as AcaoOpt[]; setAcoes(rows); if (rows.length) setAcaoId(rows[0].id); }
    });
    void bffFetch("/api/v1/formandos", { headers: { accept: "application/json" } }).then(async (r) => {
      if (r.ok) setFormandos((await r.json()) as FormandoOpt[]);
    });
  }, []);

  useEffect(() => {
    if (!acaoId) return;
    void bffFetch(`/api/v1/turmas?acaoFormacaoId=${encodeURIComponent(acaoId)}`, { headers: { accept: "application/json" } }).then(async (r) => {
      if (r.ok) { const rows = (await r.json()) as TurmaOpt[]; setTurmas(rows); if (rows.length) setTurmaId(rows[0].id); else setTurmaId(""); }
    });
  }, [acaoId]);

  const load = useCallback(async () => {
    if (!turmaId) { setMatriculas([]); return; }
    const r = await bffFetch(`/api/v1/matriculas?turmaId=${encodeURIComponent(turmaId)}`, { headers: { accept: "application/json" } });
    if (r.ok) setMatriculas((await r.json()) as MatriculaRow[]);
    else setError("Erro ao carregar matriculas.");
  }, [turmaId]);

  useEffect(() => { void load(); }, [load]);

  async function inscrever() {
    if (!canManage || !turmaId || !formandoId) return;
    setBusy(true); setError(null); setMsg(null);
    const r = await bffFetch("/api/v1/matriculas", {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({ turmaId, formandoId }),
    });
    setBusy(false);
    if (!r.ok) { setError("Erro ao inscrever. Verifica se ja esta inscrito."); return; }
    setMsg("Formando inscrito com sucesso.");
    setFormandoId("");
    await load();
  }

  async function mudarEstado(matriculaId: string, estado: string) {
    if (!canManage) return;
    setBusy(true); setError(null);
    const r = await bffFetch(`/api/v1/matriculas/${matriculaId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({ estado }),
    });
    setBusy(false);
    if (!r.ok) { setError("Erro ao actualizar estado."); return; }
    setMsg("Estado actualizado.");
    await load();
  }

  return (
    <div className="max-w-5xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-50">Inscricoes / Matriculas</h1>
        <p className="text-sm text-slate-500 mt-1">Gestao de inscricoes de formandos nas turmas das accoes de formacao.</p>
      </div>

      {error ? <div className="flex items-start gap-2.5 rounded-xl bg-red-950/40 border border-red-500/25 px-4 py-3"><p className="text-sm text-red-300">{error}</p></div> : null}
      {msg ? <div className="flex items-start gap-2.5 rounded-xl bg-green-950/30 border border-green-500/25 px-4 py-3"><p className="text-sm text-green-300">{msg}</p></div> : null}

      {/* Filters */}
      <div className="rounded-2xl bg-slate-900/50 border border-slate-700/30 p-5 space-y-4">
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">Accao</label>
            <select value={acaoId} onChange={(e) => setAcaoId(e.target.value)} className={selectClass}>
              {acoes.map((a) => <option key={a.id} value={a.id}>{a.codigoInterno} – {a.titulo}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">Turma</label>
            <select value={turmaId} onChange={(e) => setTurmaId(e.target.value)} className={selectClass}>
              {turmas.map((t) => <option key={t.id} value={t.id}>{t.codigo} – {t.nome}</option>)}
            </select>
          </div>
          {canManage ? (
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1.5">Inscrever formando</label>
              <div className="flex gap-2">
                <select value={formandoId} onChange={(e) => setFormandoId(e.target.value)} className={selectClass}>
                  <option value="">Seleccionar...</option>
                  {formandos.map((f) => <option key={f.id} value={f.id}>{f.nome} (NIF {f.nif})</option>)}
                </select>
                <button onClick={() => void inscrever()} disabled={busy || !formandoId}
                  className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium transition-colors flex-shrink-0">
                  Inscrever
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl bg-slate-900/50 border border-slate-700/30 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-700/30">
          <h2 className="text-sm font-semibold text-slate-200">Matriculas ({matriculas.length})</h2>
        </div>
        {matriculas.length === 0 ? (
          <div className="p-5 text-sm text-slate-500">Sem matriculas nesta turma.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700/30">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Formando</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Turma</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Data</th>
                {canManage ? <th className="px-4 py-3" /> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/20">
              {matriculas.map((m) => (
                <tr key={m.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-slate-200 font-medium">{m.formando.nome}</p>
                    <p className="text-xs text-slate-500">NIF {m.formando.nif}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-400 hidden sm:table-cell">{m.turma.codigo}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border ${estadoBadge[m.estado] ?? "bg-slate-500/10 text-slate-400 border-slate-500/20"}`}>
                      {m.estado}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 hidden sm:table-cell">{new Date(m.createdAt).toLocaleDateString("pt-PT")}</td>
                  {canManage ? (
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {m.estado === "ATIVA" ? (
                          <>
                            <button onClick={() => void mudarEstado(m.id, "CONCLUSAO")}
                              className="px-2.5 py-1 rounded-md bg-teal-600 hover:bg-teal-500 text-[11px] font-medium text-white transition-colors">Concluir</button>
                            <button onClick={() => void mudarEstado(m.id, "DESISTENCIA")}
                              className="px-2.5 py-1 rounded-md bg-red-600 hover:bg-red-500 text-[11px] font-medium text-white transition-colors">Desistencia</button>
                          </>
                        ) : m.estado !== "ATIVA" ? (
                          <button onClick={() => void mudarEstado(m.id, "ATIVA")}
                            className="px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-500 text-[11px] font-medium text-white transition-colors">Reactivar</button>
                        ) : null}
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
