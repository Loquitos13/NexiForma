"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { bffFetch } from "@/lib/client/bff-fetch";

type Metrics = {
  tenantsByStatus: { status: string; _count: number }[];
  totalUsers: number;
  totalAcoes: number;
  subscriptionsByStatus: { status: string; _count: number }[];
  auditEvents24h: number;
};

const statusColor: Record<string, string> = {
  ACTIVE: "text-green-400 bg-green-500/10",
  TRIAL: "text-blue-400 bg-blue-500/10",
  SUSPENDED: "text-yellow-400 bg-yellow-500/10",
  ARCHIVED: "text-slate-500 bg-slate-500/10",
};

export default function PlataformaDashboardPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const r = await bffFetch("/api/v1/control-plane/metrics", { headers: { accept: "application/json" } });
    if (!r.ok) {
      if (r.status === 403) setError("Sem permissão para ver métricas da plataforma.");
      else setError(`HTTP ${r.status}`);
    } else {
      setMetrics((await r.json()) as Metrics);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-50">Dashboard plataforma</h1>
        <p className="text-sm text-slate-500 mt-1">Métricas agregadas multi-tenant</p>
      </div>

      {error ? (
        <div className="flex items-start gap-2.5 rounded-xl bg-red-950/40 border border-red-500/25 px-4 py-3">
          <p className="text-sm text-red-300">{error}</p>
        </div>
      ) : null}

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-[#0c0a14]/80 border border-purple-500/10 p-5 animate-pulse">
              <div className="h-5 w-16 bg-slate-800 rounded mb-3" />
              <div className="h-8 w-12 bg-slate-800 rounded" />
            </div>
          ))}
        </div>
      ) : metrics ? (
        <>
          {/* Main KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard label="Utilizadores" value={metrics.totalUsers} icon="users" />
            <KpiCard label="Accoes formacao" value={metrics.totalAcoes} icon="education" />
            <KpiCard label="Auditoria 24h" value={metrics.auditEvents24h} icon="audit" />
            <KpiCard label="Subscricoes" value={metrics.subscriptionsByStatus.reduce((a, s) => a + s._count, 0)} icon="billing" />
          </div>

          {/* Tenants by status */}
          <div className="rounded-2xl bg-[#0c0a14]/80 border border-purple-500/10 p-5">
            <h2 className="text-sm font-semibold text-slate-300 mb-4">Tenants por estado</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {metrics.tenantsByStatus.map((t) => (
                <div key={t.status}
                  className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium ${statusColor[t.status] ?? "text-slate-500 bg-slate-500/10"}`}>
                    {t.status}
                  </span>
                  <span className="text-lg font-bold text-slate-100">{t._count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick links */}
          <div className="rounded-2xl bg-[#0c0a14]/80 border border-purple-500/10 p-5">
            <h2 className="text-sm font-semibold text-slate-300 mb-3">Accoes rapidas</h2>
            <div className="flex flex-wrap gap-3">
              <Link href="/plataforma/tenantes"
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-colors">
                Gerir tenants
              </Link>
              <Link href="/plataforma/auditoria"
                className="px-4 py-2 rounded-xl border border-purple-500/25 text-purple-300 hover:bg-purple-500/10 text-sm font-medium transition-colors">
                Auditoria
              </Link>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function KpiCard({ label, value, icon }: { label: string; value: number; icon: string }) {
  const icons: Record<string, React.ReactNode> = {
    users: <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />,
    education: <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342" />,
    audit: <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />,
    billing: <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />,
  };

  return (
    <div className="rounded-2xl bg-[#0c0a14]/80 border border-purple-500/10 p-5 hover:border-purple-500/20 transition-colors">
      <div className="flex items-center gap-2.5 mb-3">
        <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            {icons[icon] ?? icons.audit}
          </svg>
        </span>
        <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-2xl font-bold text-purple-100">{value.toLocaleString("pt-PT")}</p>
    </div>
  );
}
