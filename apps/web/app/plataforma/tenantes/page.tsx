"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { MODULAR_PLAN_CODE } from "@nexiforma/shared";
import { bffFetch } from "@/lib/client/bff-fetch";
import { parseApiError } from "@/lib/ui/backoffice";
import {
  TenantSubscriptionForm,
  type TenantSubscriptionFormValue,
} from "@/components/plataforma/tenant-subscription-form";

type TenantRow = {
  id: string;
  slug: string;
  legalName: string;
  nif?: string;
  status?: string;
  _count?: { users: number; acoesFormacao: number; matriculas: number };
  subscriptions?: {
    status: string;
    customAddons?: string[];
    plan: { code: string; name: string };
  }[];
};

const statusBadge: Record<string, string> = {
  ACTIVE: "bg-green-500/10 text-green-400 border-green-500/20",
  TRIAL: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  SUSPENDED: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  ARCHIVED: "bg-slate-500/10 text-slate-500 border-slate-500/20",
};

const inputClass =
  "w-full px-3 py-2 rounded-lg bg-[#0c0a14] border border-purple-500/15 text-sm text-slate-200 placeholder:text-slate-600 outline-none focus:border-purple-500/40 transition-colors";

const EMPTY_CREATE = {
  slug: "",
  legalName: "",
  nif: "",
  managerEmail: "",
  managerPassword: "",
  managerDisplayName: "",
};

const DEFAULT_SUBSCRIPTION: TenantSubscriptionFormValue = {
  planCode: "starter",
  customAddons: [],
};

function slugFromName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

export default function PlataformaTenantsPage() {
  const [rows, setRows] = useState<TenantRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_CREATE);
  const [createSubscription, setCreateSubscription] = useState<TenantSubscriptionFormValue>(DEFAULT_SUBSCRIPTION);

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

  async function criarTenant(e: FormEvent) {
    e.preventDefault();
    if (
      createSubscription.planCode === MODULAR_PLAN_CODE &&
      createSubscription.customAddons.length === 0
    ) {
      setError("Seleccione pelo menos um módulo para o plano só-módulos.");
      return;
    }
    setBusy(true);
    setError(null);
    setMsg(null);
    const body: Record<string, unknown> = {
      slug: createForm.slug.trim() || slugFromName(createForm.legalName),
      legalName: createForm.legalName.trim(),
      nif: createForm.nif.trim(),
      planCode: createSubscription.planCode,
      customAddons: createSubscription.customAddons,
    };
    if (createForm.managerEmail.trim()) {
      body.managerEmail = createForm.managerEmail.trim();
      if (createForm.managerPassword.trim()) {
        body.managerPassword = createForm.managerPassword;
      }
      if (createForm.managerDisplayName.trim()) {
        body.managerDisplayName = createForm.managerDisplayName.trim();
      }
    }
    const res = await bffFetch("/api/v1/control-plane/tenants", {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) {
      setError(await parseApiError(res));
      return;
    }
    const created = (await res.json()) as { id: string };
    setCreateOpen(false);
    setCreateForm(EMPTY_CREATE);
    setCreateSubscription(DEFAULT_SUBSCRIPTION);
    setMsg("Tenant criado.");
    await load();
    if (created.id) {
      window.location.href = `/plataforma/tenantes/${created.id}`;
    }
  }

  return (
    <div className="max-w-5xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-50">Tenants</h1>
          <p className="text-sm text-slate-500 mt-1">Gestao multi-tenant · {rows?.length ?? 0} entidades</p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors"
          >
            <Plus className="h-4 w-4" />
            Novo tenant
          </button>
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

      {msg ? (
        <div className="flex items-start gap-2.5 rounded-xl bg-green-950/30 border border-green-500/25 px-4 py-3">
          <p className="text-sm text-green-300">{msg}</p>
        </div>
      ) : null}

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
                  <td className="px-4 py-3 text-slate-400 text-xs hidden md:table-cell">
                    {r.subscriptions?.[0]?.plan.name ?? "–"}
                    {r.subscriptions?.[0]?.customAddons?.length ? (
                      <span className="block text-[10px] text-teal-400/80 mt-0.5">
                        +{r.subscriptions[0].customAddons.length} módulo(s)
                      </span>
                    ) : null}
                  </td>
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

      {createOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-[#0c0a14] border border-purple-500/20 p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-100 mb-1">Novo tenant</h2>
            <p className="text-xs text-slate-500 mb-4">
              Cria entidade formadora com subscrição trial. O super admin define plano e módulos activos.
            </p>
            <form onSubmit={(e) => void criarTenant(e)} className="grid gap-3">
              <label className="grid gap-1 text-xs text-slate-400">
                Razão social *
                <input
                  required
                  className={inputClass}
                  value={createForm.legalName}
                  onChange={(e) => {
                    const legalName = e.target.value;
                    setCreateForm((f) => ({
                      ...f,
                      legalName,
                      slug: f.slug || slugFromName(legalName),
                    }));
                  }}
                />
              </label>
              <label className="grid gap-1 text-xs text-slate-400">
                Slug *
                <input
                  required
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  className={inputClass}
                  value={createForm.slug}
                  onChange={(e) => setCreateForm((f) => ({ ...f, slug: e.target.value.toLowerCase() }))}
                  placeholder="acme-formacao"
                />
              </label>
              <label className="grid gap-1 text-xs text-slate-400">
                NIF (9 dígitos) *
                <input
                  required
                  pattern="\d{9}"
                  className={inputClass}
                  value={createForm.nif}
                  onChange={(e) => setCreateForm((f) => ({ ...f, nif: e.target.value.replace(/\D/g, "").slice(0, 9) }))}
                />
              </label>
              <TenantSubscriptionForm
                value={createSubscription}
                onChange={setCreateSubscription}
                inputClass={inputClass}
              />
              <div className="border-t border-purple-500/10 pt-3 mt-1">
                <p className="text-xs text-slate-500 mb-2">Gestor inicial (opcional)</p>
                <p className="text-xs text-teal-400/80 mb-2">
                  Indica o email - enviamos convite para activar a conta. Password só se quiseres criar a conta
                  directamente (sem email).
                </p>
                <div className="grid gap-2">
                  <input
                    type="email"
                    placeholder="Email gestor"
                    className={inputClass}
                    value={createForm.managerEmail}
                    onChange={(e) => setCreateForm((f) => ({ ...f, managerEmail: e.target.value }))}
                  />
                  <input
                    type="password"
                    placeholder="Password (opcional - omitir para enviar convite)"
                    className={inputClass}
                    value={createForm.managerPassword}
                    onChange={(e) => setCreateForm((f) => ({ ...f, managerPassword: e.target.value }))}
                  />
                  <input
                    placeholder="Nome a mostrar"
                    className={inputClass}
                    value={createForm.managerDisplayName}
                    onChange={(e) => setCreateForm((f) => ({ ...f, managerDisplayName: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={busy}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium"
                >
                  {busy ? "A criar…" : "Criar tenant"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setCreateOpen(false)}
                  className="px-4 py-2 rounded-lg border border-purple-500/20 text-slate-400 text-sm"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
