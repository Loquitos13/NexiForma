"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { useTenantRole } from "@/lib/client/use-tenant-role";
import { parseApiError } from "@/lib/ui/backoffice";

type Parceiro = {
  id: string;
  nif: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  descontoPercent: number | string | null;
  _count?: { propostas: number };
  createdAt: string;
};

const emptyForm = { nif: "", nome: "", email: "", telefone: "", moradaFiscal: "", descontoPercent: "" };

export default function ParceirosPage() {
  const { canManageCrm } = useTenantRole();
  const formRef = useRef<HTMLDivElement>(null);
  const [parceiros, setParceiros] = useState<Parceiro[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await bffFetch("/api/v1/entidades-cliente?parceiro=true", {
      headers: { accept: "application/json" },
    });
    if (!r.ok) {
      setError(await parseApiError(r));
      setLoading(false);
      return;
    }
    setParceiros((await r.json()) as Parceiro[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const entidadeId = params.get("entidade");
    if (!entidadeId || loading) return;

    void (async () => {
      const r = await bffFetch(`/api/v1/entidades-cliente/${entidadeId}`, {
        headers: { accept: "application/json" },
      });
      if (!r.ok) return;
      const p = (await r.json()) as Parceiro & { moradaFiscal?: string | null };
      setEditId(p.id);
      setForm({
        nif: p.nif,
        nome: p.nome,
        email: p.email ?? "",
        telefone: p.telefone ?? "",
        moradaFiscal: p.moradaFiscal ?? "",
        descontoPercent:
          p.descontoPercent != null && p.descontoPercent !== ""
            ? String(p.descontoPercent)
            : "",
      });
      window.history.replaceState({}, "", "/portal/parceiros");
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    })();
  }, [loading]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!canManageCrm) return;
    setBusy(true);
    setMsg(null);
    setError(null);
    const desconto = form.descontoPercent.trim();
    const descontoNum = desconto ? Number(desconto.replace(",", ".")) : null;
    const body = {
      nif: form.nif.trim(),
      nome: form.nome.trim(),
      moradaFiscal: form.moradaFiscal.trim(),
      email: form.email.trim() || undefined,
      telefone: form.telefone.trim() || undefined,
      isParceiro: true,
      descontoPercent: descontoNum,
    };
    const r = await bffFetch(editId ? `/api/v1/entidades-cliente/${editId}` : "/api/v1/entidades-cliente", {
      method: editId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify(
        editId
          ? {
              nome: body.nome,
              email: body.email,
              telefone: body.telefone,
              moradaFiscal: body.moradaFiscal || undefined,
              descontoPercent: descontoNum,
            }
          : body,
      ),
    });
    setBusy(false);
    if (!r.ok) {
      setError(await parseApiError(r));
      return;
    }
    setMsg(editId ? "Parceiro actualizado." : "Parceiro criado.");
    setEditId(null);
    setForm(emptyForm);
    await load();
  }

  function startEdit(p: Parceiro) {
    setEditId(p.id);
    setForm({
      nif: p.nif,
      nome: p.nome,
      email: p.email ?? "",
      telefone: p.telefone ?? "",
      moradaFiscal: "",
      descontoPercent:
        p.descontoPercent != null && p.descontoPercent !== ""
          ? String(p.descontoPercent)
          : "",
    });
  }

  function fmtDesconto(value: Parceiro["descontoPercent"]) {
    if (value == null || value === "") return "–";
    const n = typeof value === "number" ? value : Number(value);
    if (Number.isNaN(n)) return "–";
    return `${n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)}%`;
  }

  return (
    <div className="max-w-5xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-50">Parceiros</h1>
        <p className="text-sm text-slate-500 mt-1">
          Clientes especiais com desconto comercial negociado - condições aplicadas em propostas e
          faturação.
        </p>
      </div>

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

      {canManageCrm ? (
        <div
          ref={formRef}
          className="rounded-2xl bg-slate-900/50 border border-slate-700/30 p-5"
        >
          <h2 className="text-sm font-semibold text-slate-200 mb-1">
            {editId ? "Editar parceiro" : "Novo parceiro"}
          </h2>
          <p className="text-xs text-slate-500 mb-3">
            {editId
              ? "Define o desconto comercial acordado com este parceiro."
              : "Regista um parceiro directamente ou converte um cliente existente na lista de Clientes."}
          </p>
          <form onSubmit={(e) => void submit(e)} className="grid sm:grid-cols-2 gap-3 max-w-lg">
            {!editId ? (
              <>
                <div className="sm:col-span-2 sm:max-w-[240px]">
                  <label className="block text-xs font-medium text-slate-400 mb-1">NIF *</label>
                  <input
                    required
                    minLength={9}
                    maxLength={9}
                    value={form.nif}
                    onChange={(ev) =>
                      setForm((f) => ({
                        ...f,
                        nif: ev.target.value.replace(/\D/g, "").slice(0, 9),
                      }))
                    }
                    className="w-full px-3 py-2 rounded-lg bg-slate-900/80 border border-slate-700/60 text-sm text-slate-200 outline-none focus:border-blue-500/40"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Morada fiscal *
                  </label>
                  <textarea
                    required
                    rows={2}
                    value={form.moradaFiscal}
                    onChange={(ev) => setForm((f) => ({ ...f, moradaFiscal: ev.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900/80 border border-slate-700/60 text-sm text-slate-200 outline-none focus:border-blue-500/40"
                  />
                </div>
              </>
            ) : (
              <div className="sm:col-span-2 rounded-lg bg-slate-800/60 px-3 py-2 text-sm text-slate-400">
                NIF {form.nif}
              </div>
            )}
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-400 mb-1">Nome *</label>
              <input
                required
                value={form.nome}
                onChange={(ev) => setForm((f) => ({ ...f, nome: ev.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-slate-900/80 border border-slate-700/60 text-sm text-slate-200 outline-none focus:border-blue-500/40"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(ev) => setForm((f) => ({ ...f, email: ev.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-slate-900/80 border border-slate-700/60 text-sm text-slate-200 outline-none focus:border-blue-500/40"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Telefone</label>
              <input
                value={form.telefone}
                onChange={(ev) => setForm((f) => ({ ...f, telefone: ev.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-slate-900/80 border border-slate-700/60 text-sm text-slate-200 outline-none focus:border-blue-500/40"
              />
            </div>
            <div className="sm:max-w-[160px]">
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Desconto (%)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                step={0.01}
                placeholder="ex. 10"
                value={form.descontoPercent}
                onChange={(ev) => setForm((f) => ({ ...f, descontoPercent: ev.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-slate-900/80 border border-slate-700/60 text-sm text-slate-200 outline-none focus:border-blue-500/40"
              />
            </div>
            <div className="flex gap-2 sm:col-span-2">
              <button
                type="submit"
                disabled={busy}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium transition-colors"
              >
                {editId ? "Guardar" : "Criar parceiro"}
              </button>
              {editId ? (
                <button
                  type="button"
                  onClick={() => {
                    setEditId(null);
                    setForm(emptyForm);
                  }}
                  className="px-4 py-2 rounded-lg border border-slate-600/40 text-sm text-slate-400 hover:bg-slate-800/40 transition-colors"
                >
                  Cancelar
                </button>
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
            <p className="text-sm text-slate-500">
              Sem parceiros registados. Use «Tornar parceiro» na lista de Clientes ou crie um acima.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700/30">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Nome
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  NIF
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">
                  Contacto
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Desconto
                </th>
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
                  <td className="px-4 py-3 text-sm font-medium text-teal-300">
                    {fmtDesconto(p.descontoPercent)}
                  </td>
                  {canManageCrm ? (
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => startEdit(p)}
                        className="px-2.5 py-1 rounded-md border border-slate-600/40 text-[11px] font-medium text-slate-300 hover:bg-slate-700/40 transition-colors"
                      >
                        Editar
                      </button>
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
