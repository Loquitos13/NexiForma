"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Activity, AlertTriangle, BookOpen, GraduationCap, ShieldCheck, Users, Calendar, TrendingUp, Bell, ArrowRight } from "lucide-react";
import { PageContentSkeleton } from "@/components/ui/page-skeleton";
import { bffFetch } from "@/lib/client/bff-fetch";
import { useTenantRole } from "@/lib/client/use-tenant-role";
import { Alert, Badge, Button, Card, CardContent, CardHeader, CardTitle, DataTable, type Column } from "@/components/ui";
import { EmailBounceAlert, EmailStatusBanner } from "@/components/portal/email-status-banner";
import { bo } from "@/lib/ui/backoffice";
import { cn } from "@/lib/ui/cn";

type Dashboard = {
  tenant?: { slug?: string; legalName?: string };
  aggregates?: {
    cursos?: number;
    acoesPorEstado?: { PLANEADA?: number; EM_CURSO?: number };
    formandos?: number;
    turmas?: number;
    sessoesAgendadasFuturas?: number;
  };
};

type ComplianceResumo = {
  resumo: { totalAcoes: number; prontasInspecao: number; mediaScoreObrigatorio: number };
  acoes: Array<{
    acaoId: string; codigoInterno: string; titulo: string;
    scoreObrigatorioPercent: number; prontoInspecao: boolean; pendenciasObrigatorias: number;
  }>;
};

type ComplianceAlerta = {
  id: string; tipo: string; severidade: "critico" | "aviso";
  acaoId: string; codigoInterno: string; titulo: string; mensagem: string; accaoUrl: string;
};

type FormadorAlertaCc = {
  id: string; nomeCompleto: string; tipo: string; validade: string;
  diasRestantes: number; severidade: "critico" | "aviso";
};

const scoreColor = (pct: number) =>
  pct >= 85 ? "text-green-400" : pct >= 50 ? "text-yellow-400" : "text-red-400";

const COMPLIANCE_COLS: Column<ComplianceResumo["acoes"][0]>[] = [
  {
    key: "codigoInterno",
    header: "Acção",
    cell: (a) => (
      <div>
        <Link href={`/portal/acoes/${a.acaoId}?tab=compliance`} className="font-semibold text-blue-400 hover:text-blue-300">{a.codigoInterno}</Link>
        <div className="text-xs text-slate-500 mt-0.5 truncate max-w-[200px]">{a.titulo}</div>
      </div>
    ),
  },
  {
    key: "scoreObrigatorioPercent",
    header: "Score",
    cell: (a) => <span className={cn("font-bold tabular-nums", scoreColor(a.scoreObrigatorioPercent))}>{a.scoreObrigatorioPercent}%</span>,
  },
  {
    key: "prontoInspecao",
    header: "Inspecção",
    cell: (a) => a.prontoInspecao
      ? <Badge variant="green">Pronta</Badge>
      : <Badge variant="red">{a.pendenciasObrigatorias} pend.</Badge>,
  },
];

function StatCard({ icon: Icon, label, value, color = "text-slate-100" }: {
  icon: React.ElementType; label: string; value: number | string; color?: string;
}) {
  return (
    <Card className="flex items-center gap-4 p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-800">
        <Icon className="h-5 w-5 text-slate-400" />
      </div>
      <div>
        <div className={cn("text-2xl font-bold", color)}>{value}</div>
        <div className="text-xs text-slate-500">{label}</div>
      </div>
    </Card>
  );
}

export default function PortalDashboardPage() {
  const { canManage } = useTenantRole();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [compliance, setCompliance] = useState<ComplianceResumo | null>(null);
  const [alertas, setAlertas] = useState<ComplianceAlerta[]>([]);
  const [alertasCc, setAlertasCc] = useState<FormadorAlertaCc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notifyBusy, setNotifyBusy] = useState(false);
  const [notifyMsg, setNotifyMsg] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dashRes, compRes, alertRes, ccRes] = await Promise.all([
        bffFetch("/api/v1/portal/dashboard", { headers: { accept: "application/json" } }),
        bffFetch("/api/v1/compliance/resumo", { headers: { accept: "application/json" } }),
        bffFetch("/api/v1/compliance/alertas", { headers: { accept: "application/json" } }),
        bffFetch("/api/v1/formadores/alertas-cc", { headers: { accept: "application/json" } }),
      ]);
      if (!dashRes.ok) {
        setError(dashRes.status === 401 ? "Sessão expirada – faz login novamente." : `Erro ${dashRes.status}`);
        return;
      }
      setDashboard((await dashRes.json()) as Dashboard);
      if (compRes.ok) setCompliance((await compRes.json()) as ComplianceResumo);
      if (alertRes.ok) { const a = (await alertRes.json()) as { alertas: ComplianceAlerta[] }; setAlertas(a.alertas ?? []); }
      if (ccRes.ok) { const c = (await ccRes.json()) as { alertas: FormadorAlertaCc[] }; setAlertasCc(c.alertas ?? []); }
    } catch { setError("Falha de rede."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  async function enviarDigest() {
    setNotifyBusy(true);
    setNotifyMsg(null);
    const res = await bffFetch("/api/v1/notificacoes/alertas/digest", { method: "POST", headers: { accept: "application/json" } });
    setNotifyBusy(false);
    if (!res.ok) { setNotifyMsg(`Erro ${res.status}`); return; }
    const r = (await res.json()) as { enviados: number; alertas: number };
    setNotifyMsg(`Digest enviado a ${r.enviados} destinatário(s).`);
  }

  const agg = dashboard?.aggregates;
  const score = compliance?.resumo.mediaScoreObrigatorio ?? 0;
  const criticos = alertas.filter((a) => a.severidade === "critico");
  const avisos = alertas.filter((a) => a.severidade === "aviso");

  if (loading && !dashboard) {
    return <PageContentSkeleton variant="dashboard" />;
  }

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <div className="rounded-2xl border border-blue-700/30 bg-gradient-to-r from-blue-900/30 to-slate-900/60 p-6">
        <h1 className="text-2xl font-bold text-slate-100">
          {`Olá, ${dashboard?.tenant?.legalName ?? "Entidade formadora"}`}
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          {canManage
            ? "Visão geral da formação certificada, compliance DGERT e atalhos operacionais."
            : "Acompanha turmas, sessões e conteúdos atribuídos."}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/portal/fluxo"><Button size="sm"><Activity className="h-3.5 w-3.5" />Fluxo guiado</Button></Link>
          <Link href="/portal/acoes"><Button size="sm" variant="secondary"><GraduationCap className="h-3.5 w-3.5" />Acções</Button></Link>
          <Link href="/portal/compliance"><Button size="sm" variant="secondary"><ShieldCheck className="h-3.5 w-3.5" />Compliance</Button></Link>
        </div>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      <EmailStatusBanner />
      <EmailBounceAlert />

      {/* Stats */}
      {agg && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <StatCard icon={BookOpen} label="Cursos" value={agg.cursos ?? 0} color="text-blue-400" />
            <StatCard icon={GraduationCap} label="Em curso" value={agg.acoesPorEstado?.EM_CURSO ?? 0} color="text-green-400" />
            <StatCard icon={TrendingUp} label="Planeadas" value={agg.acoesPorEstado?.PLANEADA ?? 0} color="text-yellow-400" />
            <StatCard icon={Users} label="Formandos" value={agg.formandos ?? 0} />
            <StatCard icon={BookOpen} label="Turmas" value={agg.turmas ?? 0} />
            <StatCard icon={Calendar} label="Sessoes futuras" value={agg.sessoesAgendadasFuturas ?? 0} color="text-purple-400" />
          </div>

          {/* Action status chart */}
          {agg.acoesPorEstado ? (
            <Card>
              <CardHeader><CardTitle>Operacionalizacao da Formacao</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { label: "Planeadas", value: agg.acoesPorEstado.PLANEADA ?? 0, color: "#fbbf24", hint: "Por iniciar" },
                    { label: "Em Curso", value: agg.acoesPorEstado.EM_CURSO ?? 0, color: "#4ade80", hint: "A decorrer" },
                    { label: "Concluidas", value: (agg.acoesPorEstado as Record<string,number>).CONCLUIDA ?? 0, color: "#60a5fa", hint: "Finalizadas" },
                    { label: "Canceladas", value: (agg.acoesPorEstado as Record<string,number>).CANCELADA ?? 0, color: "#94a3b8", hint: "Interrompidas" },
                  ].map((item) => {
                    const total = (Object.values(agg.acoesPorEstado ?? {}) as number[]).reduce((a,b)=>a+b,0);
                    const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
                    const circumference = 2 * Math.PI * 32;
                    const offset = circumference - (pct / 100) * circumference;
                    return (
                      <div key={item.label} className="flex flex-col items-center text-center p-4 rounded-xl bg-slate-800/40 border border-slate-700/20">
                        <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                          <circle cx="40" cy="40" r="32" fill="none" stroke="currentColor" strokeWidth="8" className="text-slate-700" />
                          <circle cx="40" cy="40" r="32" fill="none" stroke={item.color} strokeWidth="8"
                            strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
                            className="transition-all duration-1000" />
                        </svg>
                        <p className="text-2xl font-bold mt-2 text-slate-100">{item.value}</p>
                        <p className="text-sm font-medium text-slate-300">{item.label}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">{pct}% · {item.hint}</p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ) : null}
        </>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Alertas operacionais */}
        <div className="lg:col-span-2 space-y-4">
          {(criticos.length > 0 || avisos.length > 0) && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-400" />
                    Alertas operacionais
                    {criticos.length > 0 && <Badge variant="red">{criticos.length} críticos</Badge>}
                    {avisos.length > 0 && <Badge variant="yellow">{avisos.length} avisos</Badge>}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {canManage && (
                      <Button size="sm" variant="ghost" disabled={notifyBusy} onClick={() => void enviarDigest()}>
                        <Bell className="h-3.5 w-3.5" />Digest
                      </Button>
                    )}
                    <Link href="/portal/compliance" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                      Ver todos <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
                {notifyMsg && <p className="text-xs text-green-400 mt-1">{notifyMsg}</p>}
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {alertas.slice(0, 5).map((a) => (
                    <div key={a.id} className="flex items-start gap-3 rounded-lg p-3 bg-slate-800/50">
                      <Badge variant={a.severidade === "critico" ? "red" : "yellow"}>
                        {a.severidade === "critico" ? "Crítico" : "Aviso"}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-slate-200">{a.codigoInterno}</span>
                        <span className="text-sm text-slate-400"> – {a.mensagem}</span>
                      </div>
                      <Link href={a.accaoUrl} className="shrink-0 text-xs text-blue-400 hover:text-blue-300">
                        Resolver
                      </Link>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Compliance */}
          {compliance && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-teal-400" />
                      Compliance DGERT
                    </CardTitle>
                    <p className="mt-1 text-sm text-slate-400">
                      Média obrigatórios: <span className={cn("font-bold", scoreColor(score))}>{score}%</span>
                      {" · "}{compliance.resumo.prontasInspecao}/{compliance.resumo.totalAcoes} prontas para inspecção
                    </p>
                  </div>
                  <Link href="/portal/compliance" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                    Detalhe <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <DataTable columns={COMPLIANCE_COLS} data={compliance.acoes.slice(0, 5)} keyField="acaoId" />
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar direita */}
        <div className="space-y-4">
          {/* CC/CCP */}
          {alertasCc.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">CC / CCP a renovar</CardTitle>
                  <Link href="/portal/formadores" className="text-xs text-blue-400 hover:text-blue-300">
                    Formadores →
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                {alertasCc.slice(0, 4).map((a) => (
                  <div key={a.id} className="flex items-center justify-between text-sm">
                    <div>
                      <div className="text-slate-200 font-medium">{a.nomeCompleto}</div>
                      <div className="text-xs text-slate-500">{a.tipo.toUpperCase()} · {a.validade}</div>
                    </div>
                    <Badge variant={a.severidade === "critico" ? "red" : "yellow"}>
                      {a.diasRestantes < 0 ? "Expirado" : `${a.diasRestantes}d`}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Atalhos rápidos */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Atalhos rápidos</CardTitle></CardHeader>
            <CardContent className="pt-0 grid grid-cols-2 gap-2">
              {[
                { href: "/portal/fluxo", label: "Fluxo guiado" },
                { href: "/portal/dossie", label: "Dossiê" },
                { href: "/portal/cursos", label: "Cursos" },
                { href: "/portal/conteudos", label: "LMS" },
                { href: "/portal/sigo", label: "SIGO" },
                ...(canManage ? [{ href: "/portal/utilizadores", label: "Equipa" }] : []),
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-lg border border-slate-700/50 px-3 py-2 text-center text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-slate-100 transition-colors"
                >
                  {item.label}
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
