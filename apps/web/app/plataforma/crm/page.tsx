"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { bffFetch } from "@/lib/client/bff-fetch";
import { persistAuthFromResponse } from "@/lib/client/auth-login";
import { parseApiError } from "@/lib/ui/backoffice";
import { PageContentSkeleton } from "@/components/ui/page-skeleton";

type CrmTenant = {
  id: string;
  slug: string;
  legalName: string;
  status: string;
  adminUser: { id: string; email: string; displayName: string | null } | null;
  leads: number;
  propostas: number;
  faturas: number;
};

const statusColor: Record<string, string> = {
  ACTIVE: "text-green-400 bg-green-500/10",
  TRIAL: "text-blue-400 bg-blue-500/10",
  SUSPENDED: "text-yellow-400 bg-yellow-500/10",
  ARCHIVED: "text-slate-500 bg-slate-500/10",
};

export default function PlataformaCrmPage() {
  const router = useRouter();
  const [tenants, setTenants] = useState<CrmTenant[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const r = await bffFetch("/api/v1/control-plane/crm/tenants", {
      headers: { accept: "application/json" },
    });
    if (!r.ok) {
      setError(r.status === 403 ? "Sem permissão." : `HTTP ${r.status}`);
      setLoading(false);
      return;
    }
    setTenants((await r.json()) as CrmTenant[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function enterTenant(
    tenant: CrmTenant,
    destination: "/portal/crm" | "/portal/crm/faturas",
  ) {
    if (!tenant.adminUser) {
      setError(`Tenant ${tenant.legalName} não tem gestor ADMIN activo.`);
      return;
    }
    setBusyId(tenant.id);
    setError(null);
    const r = await bffFetch("/api/auth/impersonation/start", {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        tenantId: tenant.id,
        targetUserId: tenant.adminUser.id,
        reason: destination.includes("faturas") ? "Suporte faturação" : "Suporte CRM",
        readOnly: false,
      }),
    });
    setBusyId(null);
    if (!r.ok) {
      setError(await parseApiError(r));
      return;
    }
    await persistAuthFromResponse(r);
    router.push(destination);
    router.refresh();
  }

  const totals = tenants.reduce(
    (a, t) => ({
      leads: a.leads + t.leads,
      propostas: a.propostas + t.propostas,
      faturas: a.faturas + t.faturas,
    }),
    { leads: 0, propostas: 0, faturas: 0 },
  );

  if (loading) return <PageContentSkeleton />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-50">CRM e faturação</h1>
        <p className="mt-1 text-sm text-slate-500">
          Acesso ao CRM e módulo de faturação de cada tenant via impersonação auditada.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/25 bg-red-950/40 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-3 gap-4">
        <SummaryCard label="Leads (total)" value={totals.leads} />
        <SummaryCard label="Propostas" value={totals.propostas} />
        <SummaryCard label="Faturas" value={totals.faturas} />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-purple-500/10 bg-[#0c0a14]/80">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-purple-500/10 text-xs uppercase tracking-wider text-slate-500">
              <th className="px-4 py-3 font-medium">Tenant</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium text-right">Leads</th>
              <th className="px-4 py-3 font-medium text-right">Propostas</th>
              <th className="px-4 py-3 font-medium text-right">Faturas</th>
              <th className="px-4 py-3 font-medium">Gestor</th>
              <th className="px-4 py-3 font-medium text-right">Acções</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((t) => (
              <tr key={t.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-200">{t.legalName}</div>
                  <div className="text-xs text-slate-500">{t.slug}</div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium ${statusColor[t.status] ?? "bg-slate-500/10 text-slate-500"}`}
                  >
                    {t.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-300">{t.leads}</td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-300">{t.propostas}</td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-300">{t.faturas}</td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {t.adminUser?.email ?? "-"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      disabled={busyId === t.id || !t.adminUser}
                      onClick={() => void enterTenant(t, "/portal/crm")}
                      className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-500 disabled:opacity-50"
                    >
                      CRM
                    </button>
                    <button
                      type="button"
                      disabled={busyId === t.id || !t.adminUser}
                      onClick={() => void enterTenant(t, "/portal/crm/faturas")}
                      className="rounded-lg border border-emerald-500/30 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-50"
                    >
                      Faturação
                    </button>
                    <Link
                      href={`/plataforma/tenantes/${t.id}/operacoes`}
                      className="rounded-lg border border-purple-500/20 px-3 py-1.5 text-xs text-purple-300 hover:bg-purple-500/10"
                    >
                      Ops
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!tenants.length ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">Nenhum tenant registado.</p>
        ) : null}
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-purple-500/10 bg-[#0c0a14]/80 p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-purple-100">{value.toLocaleString("pt-PT")}</p>
    </div>
  );
}
