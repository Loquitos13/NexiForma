"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { cn } from "@/lib/ui/cn";

type Dashboard = {
  summary: {
    tenantsTotal: number;
    tenantsActive: number;
    openAlerts: number;
    alerts24h: number;
    healthIssues24h: number;
    salesLeadsOpen: number;
    subsPastDue: number;
  };
  recentAlerts: AlertRow[];
  tenants: TenantRow[];
};

type AlertRow = {
  id: string;
  statusCode: number;
  httpMethod: string | null;
  httpPath: string | null;
  resumo: string;
  tenantSlug: string | null;
  status: string;
  severity: string;
  occurredAt: string;
  corpo?: string | null;
  stack?: string | null;
  tenant?: { id: string; slug: string; legalName: string } | null;
};

type TenantRow = {
  id: string;
  slug: string;
  legalName: string;
  status: string;
  openAlerts: number;
  health: {
    portalUp: boolean;
    apiUp: boolean;
    dnsOk: boolean | null;
    dnsHost: string | null;
    checkedAt: string;
    issues?: { code: string; severity: string; message: string; count?: number }[];
  } | null;
  activity: {
    leads: number;
    clientes: number;
    propostas: number;
    faturas: number;
    cursos: number;
    acoes: number;
    modulosLms: number;
    errosHttp: number;
  };
};

export default function PlataformaOperacoesPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<AlertRow | null>(null);
  const [selectedTenant, setSelectedTenant] = useState<string | null>(null);
  const [tenantDetail, setTenantDetail] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [dashR, alertsR] = await Promise.all([
      bffFetch("/api/v1/control-plane/ops/dashboard", { headers: { accept: "application/json" } }),
      bffFetch("/api/v1/control-plane/ops/alerts?limit=50", { headers: { accept: "application/json" } }),
    ]);
    if (!dashR.ok) {
      setError(dashR.status === 403 ? "Super admin necessário." : `HTTP ${dashR.status}`);
    } else {
      setData((await dashR.json()) as Dashboard);
    }
    if (alertsR.ok) setAlerts((await alertsR.json()) as AlertRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function runHealthChecks() {
    setBusy(true);
    await bffFetch("/api/v1/control-plane/ops/health/run", { method: "POST" });
    await load();
    setBusy(false);
  }

  async function resolveAlert(id: string) {
    await bffFetch(`/api/v1/control-plane/ops/alerts/${id}/resolve`, { method: "PATCH" });
    await load();
    setSelectedAlert(null);
  }

  async function openAlert(a: AlertRow) {
    const r = await bffFetch(`/api/v1/control-plane/ops/alerts/${a.id}`, {
      headers: { accept: "application/json" },
    });
    if (r.ok) setSelectedAlert((await r.json()) as AlertRow);
    else setSelectedAlert(a);
  }

  async function loadTenantDetail(id: string) {
    setSelectedTenant(id);
    const r = await bffFetch(`/api/v1/control-plane/ops/tenants/${id}`, {
      headers: { accept: "application/json" },
    });
    if (r.ok) setTenantDetail((await r.json()) as Record<string, unknown>);
  }

  const s = data?.summary;

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-50">Centro de operações</h1>
          <p className="text-sm text-slate-500 mt-1">
            Monitorização multi-tenant · DNS · alertas HTTP · CRM · faturação · LMS
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy || loading}
            onClick={() => void runHealthChecks()}
            className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-medium"
          >
            {busy ? "A verificar…" : "Executar health checks"}
          </button>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl border border-purple-500/25 text-purple-300 text-sm"
          >
            Actualizar
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl bg-red-950/40 border border-red-500/25 px-4 py-3 text-sm text-red-300">{error}</div>
      ) : null}

      {loading && !data ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-24 rounded-2xl bg-slate-800/40 animate-pulse" />
          ))}
        </div>
      ) : s ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Tenants activos" value={`${s.tenantsActive}/${s.tenantsTotal}`} tone="green" />
          <Kpi label="Alertas abertos" value={s.openAlerts} tone={s.openAlerts > 0 ? "red" : "neutral"} />
          <Kpi label="Erros 24h" value={s.alerts24h} tone={s.alerts24h > 0 ? "amber" : "neutral"} />
          <Kpi label="Saúde degradada 24h" value={s.healthIssues24h} tone={s.healthIssues24h > 0 ? "amber" : "neutral"} />
          <Kpi label="Leads site (novos)" value={s.salesLeadsOpen} tone="blue" />
          <Kpi label="Subs. em atraso" value={s.subsPastDue} tone={s.subsPastDue > 0 ? "red" : "neutral"} />
        </div>
      ) : null}

      {/* Tenants health table */}
      {data?.tenants?.length ? (
        <section className="rounded-2xl bg-[#0c0a14]/80 border border-purple-500/10 overflow-hidden">
          <div className="px-4 py-3 border-b border-purple-500/10">
            <h2 className="text-sm font-semibold text-slate-300">Estado por tenant</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-purple-500/10 text-xs text-slate-500 uppercase">
                  <th className="text-left px-4 py-2">Tenant</th>
                  <th className="text-left px-4 py-2">Portal</th>
                  <th className="text-left px-4 py-2">API</th>
                  <th className="text-left px-4 py-2">DNS</th>
                  <th className="text-left px-4 py-2">Actividade 24h</th>
                  <th className="text-left px-4 py-2">Alertas</th>
                  <th className="text-right px-4 py-2">Acções</th>
                </tr>
              </thead>
              <tbody>
                {data.tenants.map((t) => (
                  <tr key={t.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-200">{t.legalName}</div>
                      <div className="text-xs text-slate-500">{t.slug} · {t.status}</div>
                    </td>
                    <td className="px-4 py-3"><StatusDot ok={t.health?.portalUp ?? null} /></td>
                    <td className="px-4 py-3"><StatusDot ok={t.health?.apiUp ?? null} /></td>
                    <td className="px-4 py-3">
                      <StatusDot ok={t.health?.dnsOk ?? null} />
                      {t.health?.dnsHost ? (
                        <div className="text-[10px] text-slate-600 mt-0.5 truncate max-w-[120px]">{t.health.dnsHost}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      <ActivityPills a={t.activity} />
                    </td>
                    <td className="px-4 py-3">
                      {t.openAlerts > 0 ? (
                        <span className="text-red-400 font-semibold">{t.openAlerts}</span>
                      ) : (
                        <span className="text-slate-600">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => void loadTenantDetail(t.id)}
                        className="text-purple-400 hover:text-purple-300 text-xs font-medium"
                      >
                        Detalhe
                      </button>
                      <Link href={`/plataforma/tenantes/${t.id}`} className="text-slate-400 hover:text-slate-200 text-xs">
                        Gerir
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {/* Alerts */}
      <section className="rounded-2xl bg-[#0c0a14]/80 border border-purple-500/10 overflow-hidden">
        <div className="px-4 py-3 border-b border-purple-500/10 flex justify-between">
          <h2 className="text-sm font-semibold text-slate-300">Alertas HTTP (4xx / 5xx)</h2>
          <span className="text-xs text-slate-500">Emails enviados a platform_users activos</span>
        </div>
        <div className="divide-y divide-white/[0.04]">
          {alerts.length === 0 ? (
            <p className="px-4 py-8 text-sm text-slate-500 text-center">Sem alertas registados.</p>
          ) : (
            alerts.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => void openAlert(a)}
                className="w-full text-left px-4 py-3 hover:bg-white/[0.02] flex items-start gap-3"
              >
                <span className={cn(
                  "shrink-0 px-2 py-0.5 rounded text-[10px] font-bold",
                  a.statusCode >= 500 ? "bg-red-500/20 text-red-300" : "bg-amber-500/20 text-amber-300",
                )}>
                  {a.statusCode}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-slate-200 truncate">
                    {a.httpMethod} {a.httpPath}
                  </div>
                  <div className="text-xs text-slate-500 truncate">{a.resumo}</div>
                  <div className="text-[10px] text-slate-600 mt-0.5">
                    {a.tenantSlug ?? "plataforma"} · {new Date(a.occurredAt).toLocaleString("pt-PT")} · {a.status}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </section>

      {selectedAlert ? (
        <Modal onClose={() => setSelectedAlert(null)} title={`HTTP ${selectedAlert.statusCode}`}>
          <pre className="text-xs text-slate-300 whitespace-pre-wrap bg-slate-900/60 p-3 rounded-lg max-h-48 overflow-auto">
            {selectedAlert.resumo}
          </pre>
          {selectedAlert.corpo ? (
            <>
              <p className="text-xs text-slate-500 mt-3 mb-1">Corpo da resposta</p>
              <pre className="text-xs text-slate-400 whitespace-pre-wrap bg-slate-900/60 p-3 rounded-lg max-h-40 overflow-auto">
                {selectedAlert.corpo}
              </pre>
            </>
          ) : null}
          {selectedAlert.stack ? (
            <>
              <p className="text-xs text-slate-500 mt-3 mb-1">Stack</p>
              <pre className="text-[10px] text-slate-500 whitespace-pre-wrap bg-slate-900/60 p-3 rounded-lg max-h-32 overflow-auto">
                {selectedAlert.stack}
              </pre>
            </>
          ) : null}
          {selectedAlert.status !== "RESOLVED" ? (
            <button
              type="button"
              onClick={() => void resolveAlert(selectedAlert.id)}
              className="mt-4 px-4 py-2 rounded-lg bg-green-600/80 hover:bg-green-600 text-white text-sm"
            >
              Marcar resolvido
            </button>
          ) : null}
        </Modal>
      ) : null}

      {selectedTenant && tenantDetail ? (
        <Modal onClose={() => { setSelectedTenant(null); setTenantDetail(null); }} title="Detalhe operacional">
          <TenantOpsDetail data={tenantDetail} tenantId={selectedTenant} />
        </Modal>
      ) : null}
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string | number; tone: string }) {
  const colors: Record<string, string> = {
    green: "border-green-500/20 text-green-300",
    red: "border-red-500/30 text-red-300",
    amber: "border-amber-500/30 text-amber-300",
    blue: "border-blue-500/20 text-blue-300",
    neutral: "border-purple-500/10 text-purple-100",
  };
  return (
    <div className={cn("rounded-2xl bg-[#0c0a14]/80 border p-4", colors[tone] ?? colors.neutral)}>
      <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">{label}</div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  );
}

function StatusDot({ ok }: { ok: boolean | null }) {
  if (ok === null) return <span className="text-slate-600 text-xs">-</span>;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs", ok ? "text-green-400" : "text-red-400")}>
      <span className={cn("w-2 h-2 rounded-full", ok ? "bg-green-400" : "bg-red-400")} />
      {ok ? "OK" : "Falha"}
    </span>
  );
}

function ActivityPills({ a }: { a: TenantRow["activity"] }) {
  const items = [
    ["leads", a.leads],
    ["clientes", a.clientes],
    ["propostas", a.propostas],
    ["faturas", a.faturas],
    ["cursos", a.cursos],
    ["acções", a.acoes],
    ["LMS", a.modulosLms],
  ] as const;
  return (
    <div className="flex flex-wrap gap-1">
      {items.filter(([, n]) => n > 0).map(([label, n]) => (
        <span key={label} className="px-1.5 py-0.5 rounded bg-white/5 text-[10px]">
          {label}:{n}
        </span>
      ))}
      {a.errosHttp > 0 ? (
        <span className="px-1.5 py-0.5 rounded bg-red-500/15 text-red-300 text-[10px]">erros:{a.errosHttp}</span>
      ) : null}
    </div>
  );
}

function TenantOpsDetail({ data, tenantId }: { data: Record<string, unknown>; tenantId: string }) {
  const issues = (data.issues as { code: string; message: string; severity: string; count?: number }[]) ?? [];
  const activity = data.activity as TenantRow["activity"] | undefined;
  const tenant = data.tenant as { slug: string; legalName: string } | undefined;

  return (
    <div className="space-y-4 text-sm">
      <p className="text-slate-300">{tenant?.legalName} ({tenant?.slug})</p>
      {activity ? <ActivityPills a={activity} /> : null}
      {issues.length > 0 ? (
        <ul className="space-y-2">
          {issues.map((i) => (
            <li key={i.code} className={cn(
              "px-3 py-2 rounded-lg border text-xs",
              i.severity === "error" ? "border-red-500/30 bg-red-950/30 text-red-200" : "border-amber-500/20 bg-amber-950/20 text-amber-200",
            )}>
              {i.message}{i.count ? ` (${i.count})` : ""}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-slate-500 text-xs">Sem problemas detectados.</p>
      )}
      <div className="flex gap-2 pt-2">
        <Link href={`/plataforma/tenantes/${tenantId}`} className="text-purple-400 text-xs hover:underline">
          Abrir tenant →
        </Link>
      </div>
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl bg-[#0c0a14] border border-purple-500/20 p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-slate-100">{title}</h3>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-300">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
