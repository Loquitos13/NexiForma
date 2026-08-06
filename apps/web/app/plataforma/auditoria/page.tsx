"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { bffFetch } from "@/lib/client/bff-fetch";

type AuditRow = {
  id: string;
  occurredAt: string;
  action: string;
  resourceType: string;
  resourceId: string;
  targetTenantId: string | null;
  targetUserId?: string | null;
  actorType: string;
  actorId: string;
  actorIp?: string | null;
  payload?: unknown;
};

type TenantOpt = { id: string; slug?: string; legalName?: string };

const ACTOR_TYPES = [
  { value: "", label: "Todos os actores" },
  { value: "SUPERADMIN_USER", label: "Superadmin" },
  { value: "TENANT_USER", label: "Utilizador tenant" },
  { value: "SYSTEM", label: "Sistema" },
  { value: "PUBLIC_LINK", label: "Link público" },
] as const;

const ACTION_PRESETS = [
  { value: "", label: "Todas as acções" },
  { value: "document.download", label: "Downloads documentos" },
  { value: "fatura.download", label: "Downloads faturas" },
  { value: "saft.export", label: "Export SAF-T" },
  { value: "rgpd.export", label: "Export RGPD" },
  { value: "crm.proposta", label: "Propostas CRM" },
  { value: "crm.lead", label: "Leads CRM" },
  { value: "impersonation", label: "Impersonação" },
  { value: "tenant.", label: "Tenants" },
] as const;

function actorBadgeClass(actorType: string): string {
  switch (actorType) {
    case "SUPERADMIN_USER":
      return "bg-amber-500/15 text-amber-300";
    case "TENANT_USER":
      return "bg-sky-500/15 text-sky-300";
    case "PUBLIC_LINK":
      return "bg-emerald-500/15 text-emerald-300";
    case "SYSTEM":
      return "bg-slate-500/20 text-slate-300";
    default:
      return "bg-purple-500/10 text-purple-300";
  }
}

function shortId(id: string | null | undefined, n = 8): string {
  if (!id) return "–";
  return id.length <= n ? id : `${id.slice(0, n)}…`;
}

export default function PlataformaAuditoriaPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [tenants, setTenants] = useState<TenantOpt[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [obsStatus, setObsStatus] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [action, setAction] = useState("");
  const [actorType, setActorType] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [sinceDays, setSinceDays] = useState("30");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setQDebounced(q), 300);
    return () => window.clearTimeout(t);
  }, [q]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("limit", "200");
    if (qDebounced.trim()) params.set("q", qDebounced.trim());
    if (action) params.set("action", action);
    if (actorType) params.set("actorType", actorType);
    if (tenantId) params.set("tenantId", tenantId);
    const days = Number.parseInt(sinceDays, 10);
    if (Number.isFinite(days) && days > 0) {
      const since = new Date();
      since.setDate(since.getDate() - days);
      params.set("since", since.toISOString());
    }
    return params.toString();
  }, [qDebounced, action, actorType, tenantId, sinceDays]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [auditR, obsR, tenantsR] = await Promise.all([
      bffFetch(`/api/v1/control-plane/audit-logs?${queryString}`, {
        headers: { accept: "application/json" },
      }),
      bffFetch("/api/v1/control-plane/observability/status", {
        headers: { accept: "application/json" },
      }),
      bffFetch("/api/v1/control-plane/tenants", {
        headers: { accept: "application/json" },
      }),
    ]);
    if (!auditR.ok) {
      setError(auditR.status === 403 ? "Super admin necessário." : `HTTP ${auditR.status}`);
      setRows([]);
    } else {
      setRows((await auditR.json()) as AuditRow[]);
    }
    if (obsR.ok) setObsStatus((await obsR.json()) as Record<string, unknown>);
    if (tenantsR.ok) {
      const list = (await tenantsR.json()) as TenantOpt[];
      setTenants(Array.isArray(list) ? list : []);
    }
    setLoading(false);
  }, [queryString]);

  useEffect(() => {
    void load();
  }, [load]);

  const exportHref = `/api/v1/control-plane/observability/audit-export?${queryString}`;

  return (
    <div className="max-w-6xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-50">Auditoria global</h1>
          <p className="text-sm text-slate-500 mt-1">
            Control plane, CRM, downloads, links públicos e operações de sistema
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-medium transition-colors"
        >
          {loading ? "A carregar…" : "Actualizar"}
        </button>
      </div>

      <div className="rounded-2xl bg-[#0c0a14]/80 border border-purple-500/10 p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="block text-xs text-slate-500 space-y-1">
          <span>Pesquisa</span>
          <input
            type="search"
            aria-label="Pesquisar auditoria"
            placeholder="Acção, recurso, actor…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full px-3.5 py-2 rounded-xl bg-[#0c0a14] border border-purple-500/15 text-sm text-slate-200 placeholder:text-slate-600 outline-none focus:border-purple-500/40"
          />
        </label>
        <label className="block text-xs text-slate-500 space-y-1">
          <span>Acção</span>
          <select
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="w-full px-3.5 py-2 rounded-xl bg-[#0c0a14] border border-purple-500/15 text-sm text-slate-200 outline-none focus:border-purple-500/40"
          >
            {ACTION_PRESETS.map((p) => (
              <option key={p.value || "all"} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-slate-500 space-y-1">
          <span>Actor</span>
          <select
            value={actorType}
            onChange={(e) => setActorType(e.target.value)}
            className="w-full px-3.5 py-2 rounded-xl bg-[#0c0a14] border border-purple-500/15 text-sm text-slate-200 outline-none focus:border-purple-500/40"
          >
            {ACTOR_TYPES.map((p) => (
              <option key={p.value || "all"} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-slate-500 space-y-1">
          <span>Tenant</span>
          <select
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
            className="w-full px-3.5 py-2 rounded-xl bg-[#0c0a14] border border-purple-500/15 text-sm text-slate-200 outline-none focus:border-purple-500/40"
          >
            <option value="">Todos os tenants</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.legalName || t.slug || shortId(t.id)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-slate-500 space-y-1">
          <span>Desde</span>
          <select
            value={sinceDays}
            onChange={(e) => setSinceDays(e.target.value)}
            className="w-full px-3.5 py-2 rounded-xl bg-[#0c0a14] border border-purple-500/15 text-sm text-slate-200 outline-none focus:border-purple-500/40"
          >
            <option value="7">Últimos 7 dias</option>
            <option value="30">Últimos 30 dias</option>
            <option value="90">Últimos 90 dias</option>
            <option value="365">Último ano</option>
            <option value="0">Sem limite de data</option>
          </select>
        </label>
      </div>

      {obsStatus ? (
        <div className="rounded-2xl bg-[#0c0a14]/80 border border-purple-500/10 p-4 flex flex-wrap items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-400" />
            <span className="text-slate-400">
              Fila: <code className="text-purple-300">{String(obsStatus.queueBackend ?? "–")}</code>
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-400" />
            <span className="text-slate-400">
              SIGO: <code className="text-purple-300">{String(obsStatus.sigoMode ?? "–")}</code>
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${obsStatus.observabilityEnabled ? "bg-green-400" : "bg-slate-600"}`}
            />
            <span className="text-slate-400">
              Observabilidade: {obsStatus.observabilityEnabled ? "activa" : "off"}
            </span>
          </div>
          <a
            href={exportHref}
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

      <p className="text-xs text-slate-500">{loading ? "A carregar…" : `${rows.length} evento(s)`}</p>

      {loading ? (
        <div className="rounded-2xl bg-[#0c0a14]/80 border border-purple-500/10 p-3">
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-10 bg-slate-800 rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-12 rounded-2xl bg-[#0c0a14]/80 border border-purple-500/10">
          <p className="text-sm text-slate-500">Nenhum evento com estes filtros.</p>
        </div>
      ) : (
        <div className="table-scroll-shell rounded-2xl bg-[#0c0a14]/80 border border-purple-500/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-purple-500/10">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Quando
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Acção
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">
                  Recurso
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Tenant
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">
                  Actor
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">
                  IP
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-purple-500/5">
              {rows.map((r) => {
                const open = expandedId === String(r.id);
                return (
                  <Fragment key={String(r.id)}>
                    <tr
                      className="hover:bg-white/[0.02] transition-colors cursor-pointer"
                      onClick={() => setExpandedId(open ? null : String(r.id))}
                    >
                      <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap font-mono">
                        {new Date(r.occurredAt).toLocaleString("pt-PT")}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-purple-500/10 text-purple-300">
                          {r.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs hidden sm:table-cell">
                        {r.resourceType}
                        <span className="text-slate-600">/{shortId(r.resourceId)}</span>
                      </td>
                      <td className="px-4 py-3">
                        {r.targetTenantId ? (
                          <Link
                            href={`/plataforma/tenantes/${r.targetTenantId}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-purple-400 hover:text-purple-300 text-xs transition-colors"
                          >
                            {shortId(r.targetTenantId)}
                          </Link>
                        ) : (
                          <span className="text-slate-600 text-xs">–</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs hidden md:table-cell">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium ${actorBadgeClass(r.actorType)}`}
                        >
                          {r.actorType || "?"}
                        </span>
                        <span className="ml-1.5 text-slate-500 font-mono">{shortId(r.actorId)}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs hidden lg:table-cell font-mono">
                        {r.actorIp || "–"}
                      </td>
                    </tr>
                    {open ? (
                      <tr className="bg-white/[0.015]">
                        <td colSpan={6} className="px-4 py-3">
                          <pre className="text-[11px] text-slate-400 overflow-x-auto whitespace-pre-wrap break-all font-mono">
                            {JSON.stringify(
                              {
                                id: r.id,
                                actorType: r.actorType,
                                actorId: r.actorId,
                                actorIp: r.actorIp ?? null,
                                targetUserId: r.targetUserId ?? null,
                                resourceId: r.resourceId,
                                payload: r.payload ?? null,
                              },
                              null,
                              2,
                            )}
                          </pre>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
