"use client";

import { useCallback, useEffect, useState } from "react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { formatDatePt } from "@/lib/calendar-date";
import { useTenantRole } from "@/lib/client/use-tenant-role";

type AcaoOpt = { id: string; codigoInterno: string; titulo: string };
type TurmaOpt = { id: string; codigo: string; nome: string };
type MatriculaOpt = { id: string; formando: { nome: string; nif: string }; turma: { codigo: string } };
type AvaliacaoRow = {
  id: string;
  tipo: string;
  nota: number;
  observacoes: string | null;
  createdAt: string;
  createdBy?: { email: string } | null;
};

const selectClass = "w-full px-3 py-2 rounded-lg bg-slate-900/80 border border-slate-700/60 text-sm text-slate-200 outline-none focus:border-blue-500/40 transition-colors";
const inputClass = "w-full px-3 py-2 rounded-lg bg-slate-900/80 border border-slate-700/60 text-sm text-slate-200 placeholder:text-slate-500 outline-none focus:border-blue-500/40 transition-colors";

const notaColor = (n: number) => n >= 80 ? "text-green-400" : n >= 50 ? "text-yellow-400" : "text-red-400";

export default function AvaliacoesPage() {
  const { canManage } = useTenantRole();
  const [acoes, setAcoes] = useState<AcaoOpt[]>([]);
  const [turmas, setTurmas] = useState<TurmaOpt[]>([]);
  const [matriculas, setMatriculas] = useState<MatriculaOpt[]>([]);
  const [avaliacoes, setAvaliacoes] = useState<AvaliacaoRow[]>([]);
  const [acaoId, setAcaoId] = useState("");
  const [turmaId, setTurmaId] = useState("");
  const [matriculaId, setMatriculaId] = useState("");
  const [tipo, setTipo] = useState("CONTINUA");
  const [nota, setNota] = useState("");
  const [obs, setObs] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void bffFetch("/api/v1/acoes-formacao", { headers: { accept: "application/json" } }).then(async (r) => {
      if (r.ok) { const rows = (await r.json()) as AcaoOpt[]; setAcoes(rows); if (rows.length) setAcaoId(rows[0].id); }
    });
  }, []);

  useEffect(() => {
    if (!acaoId) return;
    void bffFetch(`/api/v1/turmas?acaoFormacaoId=${encodeURIComponent(acaoId)}`, { headers: { accept: "application/json" } }).then(async (r) => {
      if (r.ok) { const rows = (await r.json()) as TurmaOpt[]; setTurmas(rows); if (rows.length) setTurmaId(rows[0].id); }
    });
  }, [acaoId]);

  useEffect(() => {
    if (!turmaId) return;
    void bffFetch(`/api/v1/matriculas?turmaId=${encodeURIComponent(turmaId)}`, { headers: { accept: "application/json" } }).then(async (r) => {
      if (r.ok) { const rows = (await r.json()) as MatriculaOpt[]; setMatriculas(rows); if (rows.length) setMatriculaId(rows[0].id); }
    });
  }, [turmaId]);

  const load = useCallback(async () => {
    if (!matriculaId) { setAvaliacoes([]); return; }
    const r = await bffFetch(`/api/v1/avaliacoes/matricula/${matriculaId}`, { headers: { accept: "application/json" } });
    if (r.ok) setAvaliacoes((await r.json()) as AvaliacaoRow[]);
    else setError("Erro ao carregar avaliacoes.");
  }, [matriculaId]);

  useEffect(() => { void load(); }, [load]);

  async function criarAvaliacao() {
    if (!canManage || !matriculaId || !nota) return;
    setBusy(true); setError(null); setMsg(null);
    const r = await bffFetch(`/api/v1/avaliacoes/matricula/${matriculaId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({ tipo, nota: parseInt(nota), observacoes: obs.trim() || undefined }),
    });
    setBusy(false);
    if (!r.ok) { setError("Erro ao criar avaliacao."); return; }
    setNota(""); setObs(""); setMsg("Avaliacao registada.");
    await load();
  }

  return (
    <div className="max-w-5xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-50">Avaliacoes</h1>
        <p className="text-sm text-slate-500 mt-1">Registo de avaliacoes de formandos por tipo, nota e observacoes.</p>
      </div>

      {error ? <div className="flex items-start gap-2.5 rounded-xl bg-red-950/40 border border-red-500/25 px-4 py-3"><p className="text-sm text-red-300">{error}</p></div> : null}
      {msg ? <div className="flex items-start gap-2.5 rounded-xl bg-green-950/30 border border-green-500/25 px-4 py-3"><p className="text-sm text-green-300">{msg}</p></div> : null}

      {/* Filter chain */}
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
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">Formando (matricula)</label>
            <select value={matriculaId} onChange={(e) => setMatriculaId(e.target.value)} className={selectClass}>
              {matriculas.map((m) => <option key={m.id} value={m.id}>{m.formando.nome} · {m.turma.codigo}</option>)}
            </select>
          </div>
        </div>

        {canManage && matriculaId ? (
          <div className="border-t border-slate-700/30 pt-4 space-y-3 max-w-md">
            <h3 className="text-sm font-semibold text-slate-300">Nova avaliacao</h3>
            <div className="flex gap-3">
              <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={selectClass}>
                <option value="CONTINUA">Continua</option>
                <option value="FINAL">Final</option>
                <option value="RECUPERACAO">Recuperacao</option>
              </select>
              <input type="number" min={0} max={100} value={nota} onChange={(e) => setNota(e.target.value)}
                placeholder="Nota (0-100)" className={`${inputClass} w-32`} />
            </div>
            <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2}
              placeholder="Observacoes (opcional)" className={`${inputClass} resize-y`} />
            <button onClick={() => void criarAvaliacao()} disabled={busy || !nota}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium transition-colors">
              Registar avaliacao
            </button>
          </div>
        ) : null}
      </div>

      {/* Evaluations table */}
      <div className="rounded-2xl bg-slate-900/50 border border-slate-700/30 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-700/30">
          <h2 className="text-sm font-semibold text-slate-200">Avaliacoes ({avaliacoes.length})</h2>
        </div>
        {avaliacoes.length === 0 ? (
          <div className="p-5 text-sm text-slate-500">Sem avaliacoes registadas.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700/30">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tipo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Nota</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Observacoes</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/20">
              {avaliacoes.map((a) => (
                <tr key={a.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-purple-500/10 text-purple-400">{a.tipo}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-lg font-bold ${notaColor(a.nota)}`}>{a.nota}</span>
                    <span className="text-slate-500 text-xs">/100</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400 hidden sm:table-cell max-w-xs truncate">{a.observacoes ?? "–"}</td>
                  <td className="px-4 py-3 text-xs text-slate-500 hidden md:table-cell">{formatDatePt(a.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
