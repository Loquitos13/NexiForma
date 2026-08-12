"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  Cpu,
  Eye,
  Loader2,
  Lock,
  Radio,
  RefreshCw,
  Server,
  Shield,
  ShieldAlert,
  Zap,
} from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import {
  Access24hChart,
  CrmStackedBar,
  StatusBarChart,
  StatusPieChart,
} from "@/components/plataforma/plataforma-dashboard-charts";

type Dashboard = {
  tenantsByStatus: { status: string; _count: number }[];
  totalUsers: number;
  totalAcoes: number;
  subscriptionsByStatus: { status: string; _count: number }[];
  auditEvents24h: number;
  acessos: {
    onlineAgora: number;
    onlinePlataforma: number;
    logins24h: number;
    serie24h: { hour: string; acessos: number; tenant: number; platform: number }[];
  };
  liveTelemetry?: {
    errors15m: number;
    recentErrors: {
      id: string;
      statusCode: number;
      httpMethod: string;
      httpPath: string;
      resumo: string;
      tenantSlug: string | null;
      severity: string;
      status: string;
      occurredAt: string;
    }[];
    recentActivity: {
      id: string;
      occurredAt: string;
      action: string;
      resourceType: string;
      resourceId: string;
      targetTenantId: string | null;
      actorType: string;
      actorId: string;
      actorIp: string | null;
      encryptedActorIp: string | null;
    }[];
    systemHealth: {
      rssMb: number;
      heapUsedMb: number;
      heapTotalMb: number;
      uptimeSeconds: number;
      nodeVersion: string;
      timestamp: string;
    };
  };
  suporte: { porEstado: { status: string; _count: number }[]; abertos: number };
  crm: {
    leadsTotal: number;
    leads24h: number;
    leadsByEstado: { estado: string; _count: number }[];
    propostasTotal: number;
    propostas24h: number;
    faturasTotal: number;
    faturas24h: number;
    faturasByEstado: { estado: string; _count: number }[];
    faturasEmitidasCount: number;
    faturasEmitidasEuro: number;
  };
  impersonationActive: number;
  tenantsCrm: {
    id: string;
    slug: string;
    legalName: string;
    status: string;
    leads: number;
    propostas: number;
    faturas: number;
  }[];
};

type TicketSummary = { id: string; status: string; ticketRef: string; subject: string };

const REFRESH_MS = 30_000;

const statusColor: Record<string, string> = {
  ACTIVE: "text-green-400 bg-green-500/10",
  TRIAL: "text-blue-400 bg-blue-500/10",
  SUSPENDED: "text-yellow-400 bg-yellow-500/10",
  ARCHIVED: "text-slate-500 bg-slate-500/10",
};

export default function PlataformaDashboardPage() {
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [liveMode, setLiveMode] = useState(true);
  const [unmaskingId, setUnmaskingId] = useState<string | null>(null);
  const [revealedIps, setRevealedIps] = useState<Record<string, string>>({});

  const refreshIntervalMs = liveMode ? 5_000 : 30_000;

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    const [dashR, ticketsR] = await Promise.all([
      bffFetch("/api/v1/control-plane/dashboard", { headers: { accept: "application/json" } }),
      bffFetch("/api/v1/control-plane/support-tickets?limit=8", {
        headers: { accept: "application/json" },
      }),
    ]);
    if (!dashR.ok) {
      if (dashR.status === 403) setError("Sem permissão para ver métricas da plataforma.");
      else setError(`HTTP ${dashR.status}`);
    } else {
      setDash((await dashR.json()) as Dashboard);
      setLastUpdate(new Date());
    }
    if (ticketsR.ok) setTickets((await ticketsR.json()) as TicketSummary[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(true), refreshIntervalMs);
    return () => clearInterval(id);
  }, [load, refreshIntervalMs]);

  async function unmaskIp(id: string, encryptedIp: string) {
    if (revealedIps[id]) return;
    setUnmaskingId(id);
    try {
      const res = await bffFetch("/api/v1/control-plane/ops/unmask-ip", {
        method: "POST",
        headers: { "Content-Type": "application/json", accept: "application/json" },
        body: JSON.stringify({ encryptedIp }),
      });
      if (res.ok) {
        const d = (await res.json()) as { ip: string };
        setRevealedIps((p) => ({ ...p, [id]: d.ip }));
      }
    } finally {
      setUnmaskingId(null);
    }
  }

  const tenantChart = dash?.tenantsByStatus.map((t) => ({ status: t.status, value: t._count })) ?? [];
  const subsChart =
    dash?.subscriptionsByStatus.map((s) => ({ status: s.status, value: s._count })) ?? [];
  const leadsChart =
    dash?.crm.leadsByEstado.map((l) => ({ estado: l.estado, value: l._count })) ?? [];
  const faturasChart =
    dash?.crm.faturasByEstado.map((f) => ({ estado: f.estado, value: f._count })) ?? [];
  const ticketsChart =
    dash?.suporte.porEstado.map((t) => ({ status: t.status, value: t._count })) ?? [];
  const crmTenantsChart =
    dash?.tenantsCrm
      .filter((t) => t.leads + t.propostas + t.faturas > 0)
      .sort((a, b) => b.leads + b.propostas + b.faturas - (a.leads + a.propostas + a.faturas))
      .map((t) => ({
        nome: t.legalName,
        leads: t.leads,
        propostas: t.propostas,
        faturas: t.faturas,
      })) ?? [];

  const formatUptime = (sec?: number) => {
    if (!sec) return "–";
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return `${h}h ${m}m`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-50">Dashboard plataforma</h1>
            <button
              type="button"
              onClick={() => setLiveMode(!liveMode)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors border ${
                liveMode
                  ? "bg-emerald-950/60 border-emerald-500/40 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.2)]"
                  : "bg-slate-900 border-slate-700 text-slate-400"
              }`}
              title="Alternar modo de telemetria em tempo real"
            >
              <span className="relative flex h-2 w-2">
                {liveMode ? (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                ) : null}
                <span
                  className={`relative inline-flex h-2 w-2 rounded-full ${
                    liveMode ? "bg-emerald-500" : "bg-slate-500"
                  }`}
                />
              </span>
              <span>{liveMode ? "TEMPO REAL (5s)" : "PAUSADO (30s)"}</span>
            </button>
          </div>
          <p className="mt-1 text-sm text-slate-500">Mission Control e telemetria de segurança multi-tenant</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void load(false)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-purple-500/20 bg-purple-950/30 text-xs font-medium text-purple-300 hover:bg-purple-900/40 transition-colors"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            <span>Atualizar Agora</span>
          </button>
          {lastUpdate ? (
            <p className="text-xs text-slate-600">
              {lastUpdate.toLocaleTimeString("pt-PT")}
            </p>
          ) : null}
        </div>
      </div>

      {/* System Telemetry Pulse */}
      {dash?.liveTelemetry ? (
        <div className="rounded-2xl border border-purple-500/15 bg-[#0c0a14]/90 p-4 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-purple-400" />
              <span className="text-slate-400 font-medium">Node.js {dash.liveTelemetry.systemHealth.nodeVersion}</span>
              <span className="text-slate-600">·</span>
              <span className="text-slate-400">
                Uptime: <strong className="text-slate-200">{formatUptime(dash.liveTelemetry.systemHealth.uptimeSeconds)}</strong>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-sky-400" />
              <span className="text-slate-400">
                RAM Heap: <strong className="text-sky-300">{dash.liveTelemetry.systemHealth.heapUsedMb} MB</strong> / {dash.liveTelemetry.systemHealth.heapTotalMb} MB
              </span>
              <span className="text-slate-600">·</span>
              <span className="text-slate-400">
                RSS: <strong className="text-slate-200">{dash.liveTelemetry.systemHealth.rssMb} MB</strong>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <ShieldAlert className={`h-4 w-4 ${dash.liveTelemetry.errors15m > 0 ? "text-amber-400 animate-pulse" : "text-emerald-400"}`} />
              <span className="text-slate-400">
                Erros (15m):{" "}
                <strong className={dash.liveTelemetry.errors15m > 0 ? "text-amber-300 font-bold" : "text-emerald-400"}>
                  {dash.liveTelemetry.errors15m}
                </strong>
              </span>
            </div>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-500/25 bg-red-950/40 px-4 py-3">
          <p className="text-sm text-red-300">{error}</p>
        </div>
      ) : null}

      {loading && !dash ? (
        <DashboardSkeleton />
      ) : dash ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
            <KpiCard
              label="Online agora"
              value={dash.acessos.onlineAgora}
              hint="sessões tenant activas"
              accent="emerald"
              pulse
            />
            <KpiCard label="Logins 24h" value={dash.acessos.logins24h} hint="utilizadores tenant" />
            <KpiCard label="Leads 24h" value={dash.crm.leads24h} hint={`${dash.crm.leadsTotal} total`} />
            <KpiCard
              label="Faturas emitidas"
              value={dash.crm.faturasEmitidasCount}
              hint={`${dash.crm.faturasEmitidasEuro.toLocaleString("pt-PT", { style: "currency", currency: "EUR" })}`}
            />
            <KpiCard
              label="Tickets abertos"
              value={dash.suporte.abertos}
              hint="suporte"
              accent={dash.suporte.abertos > 0 ? "amber" : undefined}
            />
            <KpiCard
              label="Impersonações"
              value={dash.impersonationActive}
              hint="sessões activas"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Acessos - últimas 24 horas">
              <Access24hChart data={dash.acessos.serie24h} />
            </ChartCard>
            <ChartCard title="Tenants por estado">
              {tenantChart.length ? (
                <StatusPieChart data={tenantChart} labelKey="status" />
              ) : (
                <EmptyChart />
              )}
            </ChartCard>
            <ChartCard title="CRM - leads por estado">
              {leadsChart.length ? (
                <StatusBarChart data={leadsChart} labelKey="estado" />
              ) : (
                <EmptyChart />
              )}
            </ChartCard>
            <ChartCard title="Faturação - faturas por estado">
              {faturasChart.length ? (
                <StatusBarChart data={faturasChart} labelKey="estado" />
              ) : (
                <EmptyChart />
              )}
            </ChartCard>
            <ChartCard title="Subscrições">
              {subsChart.length ? (
                <StatusPieChart data={subsChart} labelKey="status" />
              ) : (
                <EmptyChart />
              )}
            </ChartCard>
            <ChartCard title="Tickets de suporte">
              {ticketsChart.length ? (
                <StatusBarChart data={ticketsChart} labelKey="status" />
              ) : (
                <EmptyChart />
              )}
            </ChartCard>
          </div>

          {crmTenantsChart.length ? (
            <ChartCard title="CRM por tenant (top actividade)">
              <CrmStackedBar data={crmTenantsChart} />
            </ChartCard>
          ) : null}

          {/* Live Radar: Erros em Tempo Real + Pulso de Atividade */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Live Error Stream */}
            <div className="rounded-2xl border border-red-500/20 bg-[#0c0a14]/90 p-5 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
                  </span>
                  <h2 className="text-sm font-semibold text-red-200">Radar de Erros em Tempo Real</h2>
                </div>
                <Link
                  href="/plataforma/operacoes"
                  className="text-xs text-red-400 hover:text-red-300 transition-colors font-medium"
                >
                  Ver Todos &rarr;
                </Link>
              </div>

              {dash.liveTelemetry?.recentErrors && dash.liveTelemetry.recentErrors.length > 0 ? (
                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  {dash.liveTelemetry.recentErrors.map((err) => (
                    <div
                      key={err.id}
                      className="rounded-xl border border-red-500/15 bg-red-950/20 p-3 text-xs space-y-1 hover:bg-red-950/30 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-1.5 py-0.5 rounded font-mono font-bold text-[10px] ${
                              err.statusCode >= 500
                                ? "bg-red-500/20 text-red-300 border border-red-500/40"
                                : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                            }`}
                          >
                            {err.statusCode}
                          </span>
                          <span className="font-mono text-slate-300 font-semibold">{err.httpMethod}</span>
                          <span className="font-mono text-slate-400 truncate max-w-[200px]" title={err.httpPath}>
                            {err.httpPath}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 whitespace-nowrap">
                          {new Date(err.occurredAt).toLocaleTimeString("pt-PT")}
                        </span>
                      </div>
                      <p className="text-slate-300 truncate" title={err.resumo}>
                        {err.resumo}
                      </p>
                      {err.tenantSlug ? (
                        <span className="inline-block text-[10px] text-purple-400 bg-purple-950/40 px-1.5 py-0.5 rounded border border-purple-500/20">
                          tenant: {err.tenantSlug}
                        </span>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
                  <Shield className="h-6 w-6 text-emerald-500" />
                  <span>Sem erros recentes no sistema. Plataforma estável!</span>
                </div>
              )}
            </div>

            {/* Live Activity Pulse */}
            <div className="rounded-2xl border border-purple-500/20 bg-[#0c0a14]/90 p-5 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-purple-400 opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-purple-500" />
                  </span>
                  <h2 className="text-sm font-semibold text-purple-200">Pulso de Atividade da Plataforma</h2>
                </div>
                <Link
                  href="/plataforma/auditoria"
                  className="text-xs text-purple-400 hover:text-purple-300 transition-colors font-medium"
                >
                  Auditoria Global &rarr;
                </Link>
              </div>

              {dash.liveTelemetry?.recentActivity && dash.liveTelemetry.recentActivity.length > 0 ? (
                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  {dash.liveTelemetry.recentActivity.map((act) => (
                    <div
                      key={act.id}
                      className="rounded-xl border border-purple-500/10 bg-white/[0.02] p-3 text-xs space-y-1 hover:bg-white/[0.04] transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-purple-300 font-medium text-[11px] bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                          {act.action}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {new Date(act.occurredAt).toLocaleTimeString("pt-PT")}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-400 text-[11px] pt-0.5">
                        <span className="truncate max-w-[200px]">
                          {act.resourceType}/{act.resourceId.slice(0, 8)}…
                        </span>
                        {act.encryptedActorIp ? (
                          revealedIps[act.id] ? (
                            <span className="text-emerald-400 font-mono text-[10px] font-semibold">
                              {revealedIps[act.id]}
                            </span>
                          ) : (
                            <button
                              type="button"
                              disabled={unmaskingId === act.id}
                              onClick={() => void unmaskIp(act.id, act.encryptedActorIp!)}
                              className="inline-flex items-center gap-1 text-[10px] text-purple-400 hover:text-purple-200 bg-purple-950/40 px-1.5 py-0.5 rounded border border-purple-500/30"
                              title="Revelar IP na sua view"
                            >
                              {unmaskingId === act.id ? (
                                <Loader2 className="h-2 w-2 animate-spin" />
                              ) : (
                                <Eye className="h-2 w-2" />
                              )}
                              <span>{act.actorIp}</span>
                            </button>
                          )
                        ) : (
                          <span className="text-slate-500 font-mono text-[10px]">{act.actorIp || "–"}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-slate-500">
                  A aguardar novos eventos em tempo real…
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Utilizadores" value={dash.totalUsers} icon="users" />
            <KpiCard label="Acções formação" value={dash.totalAcoes} icon="education" />
            <KpiCard label="Auditoria 24h" value={dash.auditEvents24h} icon="audit" />
            <KpiCard
              label="Propostas 24h"
              value={dash.crm.propostas24h}
              hint={`${dash.crm.propostasTotal} total`}
            />
          </div>

          <div className="rounded-2xl border border-purple-500/10 bg-[#0c0a14]/80 p-5">
            <h2 className="mb-4 text-sm font-semibold text-slate-300">Tenants por estado</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {dash.tenantsByStatus.map((t) => (
                <div
                  key={t.status}
                  className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.03] p-3"
                >
                  <span
                    className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ${statusColor[t.status] ?? "bg-slate-500/10 text-slate-500"}`}
                  >
                    {t.status}
                  </span>
                  <span className="text-lg font-bold text-slate-100">{t._count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-purple-500/10 bg-[#0c0a14]/80 p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-300">Acções rápidas</h2>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/plataforma/crm"
                className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-500"
              >
                CRM e faturação
              </Link>
              <Link
                href="/plataforma/tenantes"
                className="rounded-xl border border-purple-500/25 px-4 py-2 text-sm font-medium text-purple-300 transition-colors hover:bg-purple-500/10"
              >
                Gerir tenants
              </Link>
              <Link
                href="/plataforma/suporte"
                className="rounded-xl border border-cyan-500/25 px-4 py-2 text-sm font-medium text-cyan-300 transition-colors hover:bg-cyan-500/10"
              >
                Tickets suporte
                {dash.suporte.abertos ? (
                  <span className="ml-1.5 rounded-full bg-amber-500/20 px-1.5 text-amber-300">
                    {dash.suporte.abertos}
                  </span>
                ) : null}
              </Link>
              <Link
                href="/plataforma/operacoes"
                className="rounded-xl border border-amber-500/25 px-4 py-2 text-sm font-medium text-amber-300 transition-colors hover:bg-amber-500/10"
              >
                Centro de operações
              </Link>
              <Link
                href="/plataforma/auditoria"
                className="rounded-xl border border-purple-500/25 px-4 py-2 text-sm font-medium text-purple-300 transition-colors hover:bg-purple-500/10"
              >
                Auditoria
              </Link>
            </div>
          </div>

          {tickets.length ? (
            <div className="rounded-2xl border border-purple-500/10 bg-[#0c0a14]/80 p-5">
              <h2 className="mb-3 text-sm font-semibold text-slate-300">Tickets recentes</h2>
              <ul className="space-y-2">
                {tickets.slice(0, 5).map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate text-slate-300">
                      <span className="mr-2 font-mono text-xs text-purple-400">{t.ticketRef}</span>
                      {t.subject}
                    </span>
                    <span className="shrink-0 text-xs text-slate-500">{t.status}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-purple-500/10 bg-[#0c0a14]/80 p-4">
      <h2 className="mb-2 text-sm font-semibold text-slate-300">{title}</h2>
      {children}
    </div>
  );
}

function EmptyChart() {
  return (
    <p className="flex h-52 items-center justify-center text-sm text-slate-600">Sem dados</p>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-2xl border border-purple-500/10 bg-[#0c0a14]/80"
          />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-72 animate-pulse rounded-2xl border border-purple-500/10 bg-[#0c0a14]/80"
          />
        ))}
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
  icon,
  accent,
  pulse,
}: {
  label: string;
  value: number;
  hint?: string;
  icon?: string;
  accent?: "emerald" | "amber";
  pulse?: boolean;
}) {
  const icons: Record<string, ReactNode> = {
    users: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
      />
    ),
    education: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342"
      />
    ),
    audit: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
      />
    ),
  };

  const accentBorder =
    accent === "emerald"
      ? "border-emerald-500/25"
      : accent === "amber"
        ? "border-amber-500/25"
        : "border-purple-500/10";

  return (
    <div
      className={`rounded-2xl border bg-[#0c0a14]/80 p-4 transition-colors hover:border-purple-500/20 ${accentBorder}`}
    >
      <div className="mb-2 flex items-center gap-2">
        {icon ? (
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-500/10 text-purple-400">
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              {icons[icon]}
            </svg>
          </span>
        ) : pulse ? (
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </span>
        ) : null}
        <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
          {label}
        </span>
      </div>
      <p
        className={`text-2xl font-bold ${accent === "emerald" ? "text-emerald-300" : accent === "amber" ? "text-amber-300" : "text-purple-100"}`}
      >
        {value.toLocaleString("pt-PT")}
      </p>
      {hint ? <p className="mt-1 text-[10px] text-slate-600">{hint}</p> : null}
    </div>
  );
}
