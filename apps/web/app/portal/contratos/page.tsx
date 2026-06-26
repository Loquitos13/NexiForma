"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { useTenantRole } from "@/lib/client/use-tenant-role";

type Contrato = {
  id: string;
  codigo: string;
  titulo: string;
  entidade: string;
  valor: string;
  dataInicio: string;
  dataFim: string | null;
  estado: string;
  createdAt: string;
};

const estadoBadge: Record<string, string> = {
  VIGENTE: "bg-green-500/10 text-green-400 border-green-500/20",
  EXPIRADO: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  RESCINDIDO: "bg-red-500/10 text-red-400 border-red-500/20",
};

const inputClass = "w-full px-3 py-2 rounded-lg bg-slate-900/80 border border-slate-700/60 text-sm text-slate-200 placeholder:text-slate-500 outline-none focus:border-blue-500/40";

export default function ContratosPage() {
  const { canManageCrm } = useTenantRole();
  const [entidades, setEntidades] = useState<{ id: string; nome: string }[]>([]);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ entidadeId: "", codigo: "", titulo: "", valor: "", dataInicio: new Date().toISOString().split("T")[0], dataFim: "" });

  useEffect(() => {
    void bffFetch("/api/v1/entidades-cliente", { headers: { accept: "application/json" } }).then(async (r) => {
      if (r.ok) setEntidades((await r.json()) as { id: string; nome: string }[]);
    });
  }, []);

  // Contratos are derived from propostas ACEITE
  const load = useCallback(async () => {
    setError(null);
    const r = await bffFetch("/api/v1/propostas", { headers: { accept: "application/json" } });
    if (!r.ok) { setError("Erro ao carregar."); return; }
    const propostas = (await r.json()) as Array<{
      id: string; codigo: string; titulo: string; estado: string; valorCentavos: number;
      validadeAte: string | null; createdAt: string;
      entidadeCliente: { nome: string };
    }>;
    setContratos(
      propostas
        .filter((p) => p.estado === "ACEITE")
        .map((p) => ({
          id: p.id,
          codigo: p.codigo,
          titulo: p.titulo,
          entidade: p.entidadeCliente.nome,
          valor: `${(p.valorCentavos / 100).toFixed(2)} EUR`,
          dataInicio: p.createdAt.split("T")[0],
          dataFim: p.validadeAte?.split("T")[0] ?? null,
          estado: p.validadeAte && new Date(p.validadeAte) < new Date() ? "EXPIRADO" : "VIGENTE",
          createdAt: p.createdAt,
        }))
    );
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function criarProposta(e: FormEvent) {
    e.preventDefault();
    if (!canManageCrm) return;
    setBusy(true); setError(null); setMsg(null);
    const euros = Number(form.valor.replace(",", ".")) || 0;
    const r = await bffFetch("/api/v1/propostas", {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        entidadeClienteId: form.entidadeId,
        codigo: form.codigo.trim() || `CTR-${Date.now()}`,
        titulo: form.titulo.trim(),
        valorCentavos: Math.round(euros * 100),
        validadeAte: form.dataFim || undefined,
      }),
    });
    setBusy(false);
    if (!r.ok) { setError("Erro ao criar."); return; }
    setMsg("Contrato/proposta criado. Aceita na pagina de Propostas para o activar.");
    setForm({ entidadeId: "", codigo: "", titulo: "", valor: "", dataInicio: new Date().toISOString().split("T")[0], dataFim: "" });
    await load();
  }

  return (
    <div className="max-w-5xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-50">Contratos</h1>
        <p className="text-sm text-slate-500 mt-1">Gestao de contratos celebrados com empresas clientes – baseados em propostas aceites.</p>
      </div>

      {error ? <div className="flex items-start gap-2.5 rounded-xl bg-red-950/40 border border-red-500/25 px-4 py-3"><p className="text-sm text-red-300">{error}</p></div> : null}
      {msg ? <div className="flex items-start gap-2.5 rounded-xl bg-green-950/30 border border-green-500/25 px-4 py-3"><p className="text-sm text-green-300">{msg}</p></div> : null}

      {/* New contract form */}
      {canManageCrm ? (
        <div className="rounded-2xl bg-slate-900/50 border border-slate-700/30 p-5">
          <h2 className="text-sm font-semibold text-slate-200 mb-3">Novo contrato / proposta</h2>
          <form onSubmit={(e) => void criarProposta(e)} className="grid sm:grid-cols-2 gap-3 max-w-lg">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-400 mb-1">Entidade</label>
              <select value={form.entidadeId} onChange={(e) => setForm((f) => ({ ...f, entidadeId: e.target.value }))} required className={inputClass}>
                <option value="">Seleccionar...</option>
                {entidades.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Codigo</label>
              <input value={form.codigo} onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value }))} placeholder="CTR-2026-001" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Titulo *</label>
              <input value={form.titulo} onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))} required className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Valor (EUR)</label>
              <input type="number" min={0} step={0.01} value={form.valor} onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Validade</label>
              <input type="date" value={form.dataFim} onChange={(e) => setForm((f) => ({ ...f, dataFim: e.target.value }))} className={inputClass} />
            </div>
            <div className="sm:col-span-2">
              <button type="submit" disabled={busy}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium transition-colors">
                {busy ? "A criar..." : "Criar contrato"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {/* Contracts table */}
      <div className="rounded-2xl bg-slate-900/50 border border-slate-700/30 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-700/30">
          <h2 className="text-sm font-semibold text-slate-200">Contratos vigentes ({contratos.length})</h2>
        </div>
        {contratos.length === 0 ? (
          <div className="p-8 text-center">
            <svg className="w-10 h-10 text-slate-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            <p className="text-sm text-slate-500">Sem contratos. Cria uma proposta e aceita-a para gerar um contrato.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700/30">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Codigo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Entidade</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Valor</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Periodo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/20">
              {contratos.map((c) => (
                <tr key={c.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-3 text-xs font-mono text-purple-300">{c.codigo}</td>
                  <td className="px-4 py-3 text-slate-200 text-xs">{c.entidade}</td>
                  <td className="px-4 py-3 text-xs text-slate-400 hidden sm:table-cell">{c.valor}</td>
                  <td className="px-4 py-3 text-xs text-slate-500 hidden md:table-cell">{c.dataInicio}{c.dataFim ? ` – ${c.dataFim}` : ""}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border ${estadoBadge[c.estado] ?? estadoBadge.VIGENTE}`}>
                      {c.estado}
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
