"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  ArrowRight,
  BarChart3,
  BookOpen,
  Calendar,
  GraduationCap,
  LayoutDashboard,
  TrendingUp,
  Users,
} from "lucide-react";
import { PageContentSkeleton } from "@/components/ui/page-skeleton";
import { GestorRelatoriosDashboardBlock } from "@/components/dashboard/gestor-relatorios-block";
import { FormadorLmsProgressoBlock } from "@/components/dashboard/formador-lms-progresso-block";
import { bffFetch } from "@/lib/client/bff-fetch";
import { useTenantRole } from "@/lib/client/use-tenant-role";
import { useTenantEntitlements } from "@/lib/client/use-tenant-entitlements";
import { Alert, Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { EmailBounceAlert, EmailStatusBanner } from "@/components/portal/email-status-banner";
import { cn } from "@/lib/ui/cn";

type Dashboard = {
  tenant?: { slug?: string; legalName?: string };
  aggregates?: {
    cursos?: number;
    acoesPorEstado?: { PLANEADA?: number; EM_CURSO?: number; CONCLUIDA?: number; CANCELADA?: number };
    formandos?: number;
    turmas?: number;
    sessoesAgendadasFuturas?: number;
  };
};

type ComplianceResumo = {
  resumo: { totalAcoes: number; prontasInspecao: number; mediaScoreObrigatorio: number };
  acoes: Array<{
    acaoId: string;
    codigoInterno: string;
    titulo: string;
    scoreObrigatorioPercent: number;
    prontoInspecao: boolean;
    pendenciasObrigatorias: number;
  }>;
};

type ComplianceAlerta = {
  id: string;
  tipo: string;
  severidade: "critico" | "aviso";
  acaoId: string;
  codigoInterno: string;
  titulo: string;
  mensagem: string;
  accaoUrl: string;
};

type FormadorAlertaCc = {
  id: string;
  nomeCompleto: string;
  tipo: string;
  validade: string;
  diasRestantes: number;
  severidade: "critico" | "aviso";
};

function StatCard({ icon: Icon, label, value, color = "text-slate-100" }: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  color?: string;
}) {
  return (
    <Card className="flex items-center gap-3 p-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-800/80">
        <Icon className="h-4 w-4 text-slate-400" />
      </div>
      <div>
        <div className={cn("text-xl font-bold tabular-nums", color)}>{value}</div>
        <div className="text-[11px] text-slate-500">{label}</div>
      </div>
    </Card>
  );
}

export default function PortalDashboardPage() {
  const { canManage } = useTenantRole();
  const { entitlements } = useTenantEntitlements();
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
        canManage
          ? bffFetch("/api/v1/compliance/resumo", { headers: { accept: "application/json" } })
          : Promise.resolve(null),
        canManage
          ? bffFetch("/api/v1/compliance/alertas", { headers: { accept: "application/json" } })
          : Promise.resolve(null),
        canManage
          ? bffFetch("/api/v1/formadores/alertas-cc", { headers: { accept: "application/json" } })
          : Promise.resolve(null),
      ]);
      if (!dashRes.ok) {
        setError(dashRes.status === 401 ? "Sessão expirada - faça login novamente." : `Erro ${dashRes.status}`);
        return;
      }
      setDashboard((await dashRes.json()) as Dashboard);
      if (compRes?.ok) setCompliance((await compRes.json()) as ComplianceResumo);
      if (alertRes?.ok) {
        const a = (await alertRes.json()) as { alertas: ComplianceAlerta[] };
        setAlertas(a.alertas ?? []);
      }
      if (ccRes?.ok) {
        const c = (await ccRes.json()) as { alertas: FormadorAlertaCc[] };
        setAlertasCc(c.alertas ?? []);
      }
    } catch {
      setError("Falha de rede.");
    } finally {
      setLoading(false);
    }
  }, [canManage]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function enviarDigest() {
    setNotifyBusy(true);
    setNotifyMsg(null);
    const res = await bffFetch("/api/v1/notificacoes/alertas/digest", {
      method: "POST",
      headers: { accept: "application/json" },
    });
    setNotifyBusy(false);
    if (!res.ok) {
      setNotifyMsg(`Erro ${res.status}`);
      return;
    }
    const r = (await res.json()) as { enviados: number; alertas: number };
    setNotifyMsg(`Digest enviado a ${r.enviados} destinatário(s).`);
  }

  const agg = dashboard?.aggregates;

  if (loading && !dashboard) {
    return <PageContentSkeleton variant="dashboard" />;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-violet-700/25 bg-gradient-to-r from-violet-950/40 via-slate-900/50 to-slate-900/60 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-violet-400/80">
              Dashboard {canManage ? "do gestor" : "operacional"}
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-100">
              {dashboard?.tenant?.legalName ?? "Entidade formadora"}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-400">
              {canManage
                ? "Visão executiva comercial, financeira e empresarial. A formação e o compliance DGERT ficam resumidos abaixo."
                : "Acompanhe turmas, sessões e conteúdos atribuídos."}
            </p>
          </div>
          {canManage ? (
            <div className="flex flex-wrap gap-2">
              {entitlements?.canAccessInteligenciaIa ? (
                <Link href="/portal/relatorios">
                  <Button size="sm">
                    <BarChart3 className="h-3.5 w-3.5" />
                    Relatórios
                  </Button>
                </Link>
              ) : null}
              {entitlements?.canAccessCrm ? (
                <Link href="/portal/crm">
                  <Button size="sm" variant="secondary">
                    <TrendingUp className="h-3.5 w-3.5" />
                    CRM
                  </Button>
                </Link>
              ) : null}
              {(entitlements?.canAccessCoreFormation || entitlements?.canAccessFormacaoTeams) ? (
                <Link href="/portal/fluxo">
                  <Button size="sm" variant="secondary">
                    <Activity className="h-3.5 w-3.5" />
                    Fluxo guiado
                  </Button>
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {error ? <Alert variant="error">{error}</Alert> : null}
      <EmailStatusBanner />
      <EmailBounceAlert />

      {canManage ? (
        <section aria-labelledby="executive-heading">
          <div className="mb-4 flex items-center justify-between">
            <h2 id="executive-heading" className="flex items-center gap-2 text-lg font-semibold text-slate-100">
              <LayoutDashboard className="h-5 w-5 text-violet-400" />
              Dashboard
            </h2>
            {entitlements?.canAccessInteligenciaIa ? (
              <Link
                href="/portal/relatorios"
                className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
              >
                Relatórios completos <ArrowRight className="h-3 w-3" />
              </Link>
            ) : null}
          </div>
          <GestorRelatoriosDashboardBlock
            portalContext={{
              aggregates: agg,
              compliance,
              alertas,
              alertasCc,
              notifyBusy,
              notifyMsg,
              onDigest: () => void enviarDigest(),
            }}
          />
        </section>
      ) : (
        /* Vista formador - foco operacional */
        <>
          {agg ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <StatCard icon={BookOpen} label="Cursos" value={agg.cursos ?? 0} color="text-blue-400" />
              <StatCard icon={GraduationCap} label="Em curso" value={agg.acoesPorEstado?.EM_CURSO ?? 0} color="text-green-400" />
              <StatCard icon={Users} label="Formandos" value={agg.formandos ?? 0} />
              <StatCard icon={Calendar} label="Sessões futuras" value={agg.sessoesAgendadasFuturas ?? 0} color="text-purple-400" />
            </div>
          ) : null}
          <FormadorLmsProgressoBlock />
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Atalhos</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2 pt-0">
              {[
                { href: "/portal/acoes", label: "Acções" },
                { href: "/portal/calendario", label: "Calendário" },
                { href: "/portal/conteudos", label: "Conteúdos LMS" },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-lg border border-slate-700/50 px-3 py-2 text-center text-xs font-medium text-slate-300 hover:bg-slate-800"
                >
                  {item.label}
                </Link>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
