"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { bffFetch } from "@/lib/client/bff-fetch";

type TenantRow = {
  id: string;
  slug: string;
  legalName: string;
  nif?: string;
  status?: string;
  _count?: { users: number; acoesFormacao: number; matriculas: number };
  subscriptions?: { status: string; plan: { code: string; name: string } }[];
};

const statusBadge: Record<string, string> = {
  ACTIVE: "bg-green-500/10 text-green-400 border-green-500/20",
  TRIAL: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  SUSPENDED: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  ARCHIVED: "bg-slate-500/10 text-slate-500 border-slate-500/20",
};

export default function PlataformaTenantsPage() {
  const [rows, setRows] = useState<TenantRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await bffFetch("/api/v1/control-plane/tenants", { headers: { accept: "application/json" } });
      if (!res.ok) {
        if (res.status === 403) setError("Apenas super admin pode ver tenants.");
        else if (res.status === 401) setError("Sessão necessária - inicia sessão em /login.");
        else setError(`HTTP ${res.status}`);
        return;
      }
      setRows((await res.json()) as TenantRow[]);
    } catch {
      setError("Falha de rede.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = rows?.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return r.slug.toLowerCase().includes(q) || r.legalName.toLowerCase().includes(q) || (r.nif ?? "").includes(q);
  }) ?? [];

  return (
    <div className="max-w-5xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-50">Tenants</h1>
          <p className="text-sm text-slate-500 mt-1">Gestao multi-tenant · {rows?.length ?? 0} entidades</p>
        </div>
        <div className="flex items-center gap-2.5">
          <input
            type="text"
            placeholder="Buscar por nome, slug ou NIF..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3.5 py-2 rounded-xl bg-[#0c0a14] border border-purple-500/15 text-sm text-slate-200 placeholder:text-slate-600 outline-none focus:border-purple-500/40 transition-colors w-64"
          />
          <button
            onClick={() => void load()}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-medium transition-colors"
          >
            {loading ? "A carregar..." : "Actualizar"}
          </button>
        </div>
      </div>

      {error ? (
        <div className="flex items-start gap-2.5 rounded-xl bg-red-950/40 border border-red-500/25 px-4 py-3">
          <p className="text-sm text-red-300">{error}</p>
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl bg-[#0c0a14]/80 border border-purple-500/10 p-3">
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-10 bg-slate-800 rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 rounded-2xl bg-[#0c0a14]/80 border border-purple-500/10">
          <svg className="w-10 h-10 text-slate-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z" />
          </svg>
          <p className="text-sm text-slate-500">{search ? "Nenhum tenant encontrado." : "Sem tenants registados."}</p>
        </div>
      ) : (
        <div className="rounded-2xl bg-[#0c0a14]/80 border border-purple-500/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-purple-500/10">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Slug</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Razao social</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">NIF</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Plano</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Users</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-purple-500/5">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3">
                    <code className="text-purple-300 text-xs">{r.slug}</code>
                  </td>
                  <td className="px-4 py-3 text-slate-200 font-medium">{r.legalName}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs hidden sm:table-cell">{r.nif ?? "–"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border ${statusBadge[r.status ?? ""] ?? statusBadge.TRIAL}`}>
                      {r.status ?? "TRIAL"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs hidden md:table-cell">{r.subscriptions?.[0]?.plan.name ?? "–"}</td>
                  <td className="px-4 py-3 text-center text-slate-400">{r._count?.users ?? "–"}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/plataforma/tenantes/${r.id}`}
                      className="text-purple-400 hover:text-purple-300 text-xs font-semibold transition-colors"
                    >
                      Detalhe →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
