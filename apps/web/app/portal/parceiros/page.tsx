"use client";

import Link from "next/link";
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

type ClienteOpt = {
  id: string;
  nif: string;
  nome: string;
  email: string | null;
  telefone: string | null;
};

export default function ParceirosPage() {
  const { canManageCrm } = useTenantRole();
  const formRef = useRef<HTMLDivElement>(null);
  const [parceiros, setParceiros] = useState<Parceiro[]>([]);
  const [clientesDisponiveis, setClientesDisponiveis] = useState<ClienteOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [clienteId, setClienteId] = useState("");
  const [descontoPercent, setDescontoPercent] = useState("");
  const [editLabel, setEditLabel] = useState("");

  const loadParceiros = useCallback(async () => {
    const r = await bffFetch("/api/v1/entidades-cliente?parceiro=true", {
      headers: { accept: "application/json" },
    });
    if (!r.ok) {
      setError(await parseApiError(r));
      return;
    }
    setParceiros((await r.json()) as Parceiro[]);
  }, []);

  const loadClientesDisponiveis = useCallback(async () => {
    const r = await bffFetch("/api/v1/entidades-cliente?parceiro=false", {
      headers: { accept: "application/json" },
    });
    if (!r.ok) return;
    const data = await r.json();
    const list = Array.isArray(data) ? data : (data as { items: ClienteOpt[] }).items;
    setClientesDisponiveis(Array.isArray(list) ? list : []);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    await Promise.all([loadParceiros(), loadClientesDisponiveis()]);
    setLoading(false);
  }, [loadParceiros, loadClientesDisponiveis]);

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
      const p = (await r.json()) as Parceiro & { isParceiro?: boolean };
      const desconto =
        p.descontoPercent != null && p.descontoPercent !== ""
          ? String(p.descontoPercent)
          : "";
      if (p.isParceiro) {
        setEditId(p.id);
        setClienteId("");
        setEditLabel(`${p.nome} · NIF ${p.nif}`);
        setDescontoPercent(desconto);
      } else {
        setEditId(null);
        setClienteId(p.id);
        setEditLabel("");
        setDescontoPercent(desconto);
        setClientesDisponiveis((prev) =>
          prev.some((c) => c.id === p.id)
            ? prev
            : [
                {
                  id: p.id,
                  nif: p.nif,
                  nome: p.nome,
                  email: p.email,
                  telefone: p.telefone,
                },
                ...prev,
              ],
        );
      }
      window.history.replaceState({}, "", "/portal/parceiros");
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    })();
  }, [loading]);

  function resetForm() {
    setEditId(null);
    setClienteId("");
    setDescontoPercent("");
    setEditLabel("");
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!canManageCrm) return;

    const targetId = editId || clienteId;
    if (!targetId) {
      setError("Seleccione um cliente existente para tornar parceiro.");
      return;
    }

    setBusy(true);
    setMsg(null);
    setError(null);
    const desconto = descontoPercent.trim();
    const descontoNum = desconto ? Number(desconto.replace(",", ".")) : null;
    if (desconto && (descontoNum == null || Number.isNaN(descontoNum) || descontoNum < 0 || descontoNum > 100)) {
      setBusy(false);
      setError("Desconto inválido (0 a 100%).");
      return;
    }

    const r = await bffFetch(`/api/v1/entidades-cliente/${targetId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        isParceiro: true,
        descontoPercent: descontoNum,
      }),
    });
    setBusy(false);
    if (!r.ok) {
      setError(await parseApiError(r));
      return;
    }
    setMsg(editId ? "Parceiro actualizado." : "Cliente adicionado como parceiro.");
    resetForm();
    await load();
  }

  function startEdit(p: Parceiro) {
    setEditId(p.id);
    setClienteId("");
    setEditLabel(`${p.nome} · NIF ${p.nif}`);
    setDescontoPercent(
      p.descontoPercent != null && p.descontoPercent !== ""
        ? String(p.descontoPercent)
        : "",
    );
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function fmtDesconto(value: Parceiro["descontoPercent"]) {
    if (value == null || value === "") return "–";
    const n = typeof value === "number" ? value : Number(value);
    if (Number.isNaN(n)) return "–";
    return `${n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)}%`;
  }

  const clienteSeleccionado = clientesDisponiveis.find((c) => c.id === clienteId);

  return (
    <div className="max-w-5xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-50">Parceiros</h1>
        <p className="text-sm text-slate-500 mt-1">
          Parceiros são clientes da entidade com desconto comercial negociado. Escolhe um cliente
          existente para o adicionar aqui.
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
            {editId ? "Editar parceiro" : "Adicionar parceiro"}
          </h2>
          <p className="text-xs text-slate-500 mb-3">
            {editId
              ? "Actualiza o desconto comercial deste parceiro."
              : "Selecciona um cliente já registado na entidade. Se ainda não existir, cria-o primeiro em Clientes."}
          </p>
          <form onSubmit={(e) => void submit(e)} className="grid sm:grid-cols-2 gap-3 max-w-lg">
            {editId ? (
              <div className="sm:col-span-2 rounded-lg bg-slate-800/60 px-3 py-2 text-sm text-slate-300">
                {editLabel}
              </div>
            ) : (
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Cliente existente *
                </label>
                <select
                  required
                  value={clienteId}
                  onChange={(ev) => setClienteId(ev.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900/80 border border-slate-700/60 text-sm text-slate-200 outline-none focus:border-blue-500/40"
                >
                  <option value="">Seleccionar cliente…</option>
                  {clientesDisponiveis.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome} · NIF {c.nif}
                    </option>
                  ))}
                </select>
                {clientesDisponiveis.length === 0 ? (
                  <p className="mt-2 text-xs text-slate-500">
                    Não há clientes disponíveis (ou todos já são parceiros).{" "}
                    <Link href="/portal/clientes" className="text-blue-400 hover:underline">
                      Ir a Clientes
                    </Link>
                  </p>
                ) : null}
                {clienteSeleccionado ? (
                  <p className="mt-2 text-xs text-slate-500">
                    {clienteSeleccionado.email ?? "Sem email"}
                    {clienteSeleccionado.telefone
                      ? ` · ${clienteSeleccionado.telefone}`
                      : ""}
                  </p>
                ) : null}
              </div>
            )}
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
                value={descontoPercent}
                onChange={(ev) => setDescontoPercent(ev.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-900/80 border border-slate-700/60 text-sm text-slate-200 outline-none focus:border-blue-500/40"
              />
            </div>
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <button
                type="submit"
                disabled={busy || (!editId && !clienteId)}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium transition-colors"
              >
                {editId ? "Guardar" : "Adicionar como parceiro"}
              </button>
              {editId || clienteId || descontoPercent ? (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 rounded-lg border border-slate-600/40 text-sm text-slate-400 hover:bg-slate-800/40 transition-colors"
                >
                  Cancelar
                </button>
              ) : null}
            </div>
          </form>
        </div>
      ) : null}

      <div className="table-scroll-shell rounded-2xl bg-slate-900/50 border border-slate-700/30">
        <div className="px-5 py-4 border-b border-slate-700/30">
          <h2 className="text-sm font-semibold text-slate-200">Parceiros ({parceiros.length})</h2>
        </div>
        {loading ? (
          <div className="p-5 text-sm text-slate-500">A carregar...</div>
        ) : parceiros.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-slate-500">
              Sem parceiros. Adiciona um a partir de um{" "}
              <Link href="/portal/clientes" className="text-blue-400 hover:underline">
                cliente existente
              </Link>
              .
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
                        type="button"
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
