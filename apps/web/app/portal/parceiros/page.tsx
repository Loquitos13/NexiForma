"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { useTenantRole } from "@/lib/client/use-tenant-role";

type Parceiro = {
  id: string;
  nif: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  _count?: { formandos: number; propostas: number };
  createdAt: string;
};

export default function ParceirosPage() {
  const { canManageCrm } = useTenantRole();
  const [parceiros, setParceiros] = useState<Parceiro[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ nif: "", nome: "", email: "", telefone: "" });

  const load = useCallback(async () => {
    setLoading(true);
    const r = await bffFetch("/api/v1/entidades-cliente", { headers: { accept: "application/json" } });
    if (!r.ok) { setError("Erro ao carregar."); setLoading(false); return; }
    setParceiros((await r.json()) as Parceiro[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!canManageCrm) return;
    setBusy(true); setMsg(null); setError(null);
    const body = { nif: form.nif.trim(), nome: form.nome.trim(), email: form.email.trim() || undefined, telefone: form.telefone.trim() || undefined };
    const r = await bffFetch(editId ? `/api/v1/entidades-cliente/${editId}` : "/api/v1/entidades-cliente", {
      method: editId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify(editId ? { nome: body.nome, email: body.email, telefone: body.telefone } : body),
    });
    setBusy(false);
    if (!r.ok) { setError("Erro ao guardar."); return; }
    setMsg(editId ? "Parceiro actualizado." : "Parceiro criado.");
    setEditId(null); setForm({ nif: "", nome: "", email: "", telefone: "" });
    await load();
  }

  function startEdit(p: Parceiro) {
    setEditId(p.id);
    setForm({ nif: p.nif, nome: p.nome, email: p.email ?? "", telefone: p.telefone ?? "" });
  }

  return (
    <div className="max-w-5xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-50">Parceiros</h1>
        <p className="text-sm text-slate-500 mt-1">Empresas parceiras nos processos de formacao – gestao de contactos e relacoes.</p>
      </div>

      {error ? <div className="flex items-start gap-2.5 rounded-xl bg-red-950/40 border border-red-500/25 px-4 py-3"><p className="text-sm text-red-300">{error}</p></div> : null}
      {msg ? <div className="flex items-start gap-2.5 rounded-xl bg-green-950/30 border border-green-500/25 px-4 py-3"><p className="text-sm text-green-300">{msg}</p></div> : null}

      {canManageCrm ? (
        <div className="rounded-2xl bg-slate-900/50 border border-slate-700/30 p-5">
          <h2 className="text-sm font-semibold text-slate-200 mb-3">{editId ? "Editar parceiro" : "Novo parceiro"}</h2>
          <form onSubmit={(e) => void submit(e)} className="grid sm:grid-cols-2 gap-3 max-w-lg">
            {!editId ? (
              <div className="sm:col-span-2 sm:max-w-[240px]">
                <label className="block text-xs font-medium text-slate-400 mb-1">NIF *</label>
                <input required minLength={9} maxLength={9} value={form.nif} onChange={(ev) => setForm((f) => ({ ...f, nif: ev.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900/80 border border-slate-700/60 text-sm text-slate-200 outline-none focus:border-blue-500/40" />
              </div>
            ) : null}
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-400 mb-1">Nome *</label>
              <input required value={form.nome} onChange={(ev) => setForm((f) => ({ ...f, nome: ev.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-slate-900/80 border border-slate-700/60 text-sm text-slate-200 outline-none focus:border-blue-500/40" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Email</label>
              <input type="email" value={form.email} onChange={(ev) => setForm((f) => ({ ...f, email: ev.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-slate-900/80 border border-slate-700/60 text-sm text-slate-200 outline-none focus:border-blue-500/40" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Telefone</label>
              <input value={form.telefone} onChange={(ev) => setForm((f) => ({ ...f, telefone: ev.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-slate-900/80 border border-slate-700/60 text-sm text-slate-200 outline-none focus:border-blue-500/40" />
            </div>
            <div className="flex gap-2 sm:col-span-2">
              <button type="submit" disabled={busy}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium transition-colors">{editId ? "Guardar" : "Criar parceiro"}</button>
              {editId ? (
                <button type="button" onClick={() => { setEditId(null); setForm({ nif: "", nome: "", email: "", telefone: "" }); }}
                  className="px-4 py-2 rounded-lg border border-slate-600/40 text-sm text-slate-400 hover:bg-slate-800/40 transition-colors">Cancelar</button>
              ) : null}
            </div>
          </form>
        </div>
      ) : null}

      <div className="rounded-2xl bg-slate-900/50 border border-slate-700/30 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-700/30">
          <h2 className="text-sm font-semibold text-slate-200">Parceiros ({parceiros.length})</h2>
        </div>
        {loading ? (
          <div className="p-5 text-sm text-slate-500">A carregar...</div>
        ) : parceiros.length === 0 ? (
          <div className="p-8 text-center">
            <svg className="w-10 h-10 text-slate-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
            </svg>
            <p className="text-sm text-slate-500">Sem parceiros registados.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700/30">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Nome</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">NIF</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Contacto</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Formandos</th>
                {canManageCrm ? <th className="px-4 py-3" /> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/20">
              {parceiros.map((p) => (
                <tr key={p.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-3 text-slate-200 font-medium">{p.nome}</td>
                  <td className="px-4 py-3 text-xs text-slate-400">{p.nif}</td>
                  <td className="px-4 py-3 text-xs text-slate-400 hidden sm:table-cell">
                    {p.email ?? "–"}
                    {p.telefone ? <span className="block text-slate-600">{p.telefone}</span> : null}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 hidden md:table-cell">{p._count?.formandos ?? 0}</td>
                  {canManageCrm ? (
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => startEdit(p)}
                        className="px-2.5 py-1 rounded-md border border-slate-600/40 text-[11px] font-medium text-slate-300 hover:bg-slate-700/40 transition-colors">Editar</button>
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
