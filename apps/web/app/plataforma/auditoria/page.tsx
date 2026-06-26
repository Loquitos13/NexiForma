"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { bffFetch } from "@/lib/client/bff-fetch";

type AuditRow = {
  id: string;
  occurredAt: string;
  action: string;
  resourceType: string;
  resourceId: string;
  targetTenantId: string | null;
  actorId: string;
};

export default function PlataformaAuditoriaPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [obsStatus, setObsStatus] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [auditR, obsR] = await Promise.all([
      bffFetch("/api/v1/control-plane/audit-logs?limit=80", { headers: { accept: "application/json" } }),
      bffFetch("/api/v1/control-plane/observability/status", { headers: { accept: "application/json" } }),
    ]);
    if (!auditR.ok) {
      setError(auditR.status === 403 ? "Super admin necessario." : `HTTP ${auditR.status}`);
    } else {
      setRows((await auditR.json()) as AuditRow[]);
    }
    if (obsR.ok) setObsStatus((await obsR.json()) as Record<string, unknown>);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = rows.filter((r) => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return r.action.toLowerCase().includes(q) || r.resourceType.toLowerCase().includes(q);
  });

  return (
    <div className="max-w-5xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-50">Auditoria global</h1>
          <p className="text-sm text-slate-500 mt-1">Eventos do Control Plane · logs JSON para CloudWatch</p>
        </div>
        <div className="flex items-center gap-2.5">
          <input
            type="text"
            placeholder="Filtrar por accao ou recurso..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-3.5 py-2 rounded-xl bg-[#0c0a14] border border-purple-500/15 text-sm text-slate-200 placeholder:text-slate-600 outline-none focus:border-purple-500/40 transition-colors w-56"
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

      {/* Observability status */}
      {obsStatus ? (
        <div className="rounded-2xl bg-[#0c0a14]/80 border border-purple-500/10 p-4 flex flex-wrap items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-400" />
            <span className="text-slate-400">Fila: <code className="text-purple-300">{String(obsStatus.queueBackend ?? "–")}</code></span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-400" />
            <span className="text-slate-400">SIGO: <code className="text-purple-300">{String(obsStatus.sigoMode ?? "–")}</code></span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${obsStatus.observabilityEnabled ? "bg-green-400" : "bg-slate-600"}`} />
            <span className="text-slate-400">Observabilidade: {obsStatus.observabilityEnabled ? "activa" : "off"}</span>
          </div>
          <a
            href="/api/v1/control-plane/observability/audit-export?limit=200"
            className="ml-auto text-purple-400 hover:text-purple-300 transition-colors font-medium"
          >
            Export JSON (CloudWatch)
          </a>
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
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-10 bg-slate-800 rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 rounded-2xl bg-[#0c0a14]/80 border border-purple-500/10">
          <p className="text-sm text-slate-500">{filter ? "Nenhum evento encontrado." : "Sem eventos registados."}</p>
        </div>
      ) : (
        <div className="rounded-2xl bg-[#0c0a14]/80 border border-purple-500/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-purple-500/10">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Quando</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Accao</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Recurso</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tenant</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Actor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-purple-500/5">
              {filtered.map((r) => (
                <tr key={String(r.id)} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap font-mono">
                    {new Date(r.occurredAt).toLocaleString("pt-PT")}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-purple-500/10 text-purple-300">
                      {r.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs hidden sm:table-cell">
                    {r.resourceType}<span className="text-slate-600">/{r.resourceId.slice(0, 8)}...</span>
                  </td>
                  <td className="px-4 py-3">
                    {r.targetTenantId ? (
                      <Link href={`/plataforma/tenantes/${r.targetTenantId}`}
                        className="text-purple-400 hover:text-purple-300 text-xs transition-colors">
                        {r.targetTenantId.slice(0, 8)}...
                      </Link>
                    ) : (
                      <span className="text-slate-600 text-xs">–</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs hidden md:table-cell font-mono">
                    {r.actorId ? r.actorId.slice(0, 8) + "..." : "–"}
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
