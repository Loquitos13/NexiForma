"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Building2,
  FileText,
  GraduationCap,
  TrendingUp,
  Users,
  ArrowRight,
  Plus,
  UserPlus,
} from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { parseApiError } from "@/lib/ui/backoffice";
import {
  Alert,
  Badge,
  buttonVariants,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DataTable,
  PageHeader,
  type Column,
} from "@/components/ui";
import { cn } from "@/lib/ui/cn";
import { PropostaEstadoBadge } from "@/components/crm/proposta-estado-badge";
import { fmtEuro, propostaEstadoLabel, type PropostaEstado } from "@/lib/crm/shared";

type Estatisticas = {
  totalEntidades: number;
  entidadesAtivas: number;
  totalFormandos: number;
  totalPropostas: number;
  proposttasAceitadas: number;
  faturacaoTotalCentavos: number;
  faturasEmitidas: number;
  faturasComunicadasAt: number;
  faturasPendentesAt: number;
  valorFaturadoCentavos: number;
  leadsTotal: number;
  leadsAbertos: number;
  leadsConvertidos: number;
  pipelineLeadsCentavos: number;
};

type Proposta = {
  id: string;
  codigo: string;
  titulo: string;
  estado: string;
  valorCentavos: number;
  createdAt?: string;
  entidadeCliente: { nome: string };
};

const PIPELINE: PropostaEstado[] = ["RASCUNHO", "ENVIADA", "ACEITE", "REJEITADA"];

export default function CrmDashboardPage() {
  const [stats, setStats] = useState<Estatisticas | null>(null);
  const [propostas, setPropostas] = useState<Proposta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sRes, pRes] = await Promise.all([
        bffFetch("/api/v1/crm/estatisticas", { headers: { accept: "application/json" } }),
        bffFetch("/api/v1/propostas", { headers: { accept: "application/json" } }),
      ]);
      if (sRes.ok) setStats((await sRes.json()) as Estatisticas);
      else if (sRes.status !== 404) setError(await parseApiError(sRes));
      if (pRes.ok) setPropostas((await pRes.json()) as Proposta[]);
      else if (pRes.status !== 404) setError(await parseApiError(pRes));
    } catch {
      setError("Erro ao carregar dados do CRM.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const taxaConversao =
    stats && stats.totalPropostas > 0
      ? Math.round((stats.proposttasAceitadas / stats.totalPropostas) * 100)
      : 0;

  const pipelineCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of PIPELINE) counts[e] = 0;
    for (const p of propostas) {
      if (counts[p.estado] !== undefined) counts[p.estado]++;
    }
    return counts;
  }, [propostas]);

  const recentes = useMemo(
    () =>
      [...propostas]
        .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
        .slice(0, 8),
    [propostas],
  );

  const COLS: Column<Proposta>[] = [
    {
      key: "codigo",
      header: "Proposta",
      cell: (p) => (
        <div>
          <span className="font-medium text-slate-100">{p.codigo}</span>
          <p className="text-xs text-slate-500 mt-0.5">{p.titulo}</p>
        </div>
      ),
    },
    {
      key: "entidadeCliente",
      header: "Entidade",
      cell: (p) => <span className="text-slate-300">{p.entidadeCliente?.nome ?? "-"}</span>,
    },
    {
      key: "valorCentavos",
      header: "Valor",
      cell: (p) => <span className="font-medium text-slate-200">{fmtEuro(p.valorCentavos)}</span>,
    },
    {
      key: "estado",
      header: "Estado",
      cell: (p) => <PropostaEstadoBadge estado={p.estado} />,
    },
  ];

  return (
    <>
      <PageHeader
        title="CRM"
        description="Pipeline comercial, entidades B2B, propostas e equipa formativa."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/portal/entidades" className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}>
              <Building2 className="h-3.5 w-3.5" />
              Entidades
            </Link>
            <Link href="/portal/propostas" className={cn(buttonVariants({ size: "sm" }))}>
              <Plus className="h-3.5 w-3.5" />
              Nova proposta
            </Link>
          </div>
        }
      />

      {error && <Alert variant="error" className="mb-4">{error}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
        <KpiCard
          icon={<Building2 className="h-5 w-5 text-blue-400" />}
          label="Entidades"
          value={stats?.totalEntidades ?? 0}
          sub={`${stats?.entidadesAtivas ?? 0} activas`}
          loading={loading}
        />
        <KpiCard
          icon={<Users className="h-5 w-5 text-amber-400" />}
          label="Formandos B2B"
          value={stats?.totalFormandos ?? 0}
          sub="ligados a entidades"
          loading={loading}
        />
        <KpiCard
          icon={<FileText className="h-5 w-5 text-violet-400" />}
          label="Propostas"
          value={stats?.totalPropostas ?? 0}
          sub={`${stats?.proposttasAceitadas ?? 0} aceites · ${taxaConversao}% conversão`}
          loading={loading}
        />
        <KpiCard
          icon={<TrendingUp className="h-5 w-5 text-emerald-400" />}
          label="Facturação pipeline"
          value={fmtEuro(stats?.faturacaoTotalCentavos ?? 0)}
          sub="propostas aceites"
          loading={loading}
          isCurrency
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
        <KpiCard
          icon={<FileText className="h-5 w-5 text-teal-400" />}
          label="Faturas emitidas"
          value={stats?.faturasEmitidas ?? 0}
          sub={`${fmtEuro(stats?.valorFaturadoCentavos ?? 0)} facturado`}
          loading={loading}
        />
        <KpiCard
          icon={<FileText className="h-5 w-5 text-green-400" />}
          label="Comunicadas AT"
          value={stats?.faturasComunicadasAt ?? 0}
          sub="webservice AT"
          loading={loading}
        />
        <KpiCard
          icon={<FileText className="h-5 w-5 text-amber-400" />}
          label="Pendentes AT"
          value={stats?.faturasPendentesAt ?? 0}
          sub="emitidas, por comunicar"
          loading={loading}
        />
        <Link
          href="/portal/crm/faturas"
          className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-5 flex flex-col justify-center hover:border-blue-500/30 transition-colors"
        >
          <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Export contabilidade</p>
          <p className="text-sm font-medium text-blue-300">SAF-T PT →</p>
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
        <KpiCard
          icon={<UserPlus className="h-5 w-5 text-indigo-400" />}
          label="Leads abertos"
          value={stats?.leadsAbertos ?? 0}
          sub={`${stats?.leadsTotal ?? 0} total · ${fmtEuro(stats?.pipelineLeadsCentavos ?? 0)} pipeline`}
          loading={loading}
        />
        <KpiCard
          icon={<UserPlus className="h-5 w-5 text-green-400" />}
          label="Leads convertidos"
          value={stats?.leadsConvertidos ?? 0}
          sub="entidades criadas"
          loading={loading}
        />
        <Link
          href="/portal/crm/leads"
          className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-5 flex flex-col justify-center hover:border-indigo-500/30 transition-colors sm:col-span-2"
        >
          <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Pipeline comercial</p>
          <p className="text-sm font-medium text-indigo-300 flex items-center gap-1">
            Gerir leads <ArrowRight className="h-3.5 w-3.5" />
          </p>
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-3 mb-6">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Pipeline de propostas</CardTitle>
            <Link href="/portal/propostas" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
              Ver todas <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Link>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {PIPELINE.map((estado) => (
                <Link
                  key={estado}
                  href={`/portal/propostas?estado=${estado}`}
                  className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-4 hover:border-slate-600 transition-colors"
                >
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">
                    {propostaEstadoLabel(estado)}
                  </p>
                  <p className="text-2xl font-bold text-slate-100">
                    {loading ? "-" : pipelineCounts[estado]}
                  </p>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-teal-400" />
              Acções rápidas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href="/portal/entidades?nova=1" className={cn(buttonVariants({ variant: "secondary" }), "w-full justify-start")}>
              <Building2 className="h-4 w-4" />
              Registar entidade cliente
            </Link>
            <Link href="/portal/propostas?nova=1" className={cn(buttonVariants({ variant: "secondary" }), "w-full justify-start")}>
              <FileText className="h-4 w-4" />
              Criar proposta comercial
            </Link>
            <Link href="/portal/crm/leads?nova=1" className={cn(buttonVariants({ variant: "secondary" }), "w-full justify-start")}>
              <UserPlus className="h-4 w-4" />
              Registar lead
            </Link>
            <Link href="/portal/crm/faturas" className={cn(buttonVariants({ variant: "secondary" }), "w-full justify-start")}>
              <FileText className="h-4 w-4" />
              Faturas comerciais
            </Link>
            <Link href="/portal/formadores" className={cn(buttonVariants({ variant: "secondary" }), "w-full justify-start")}>
              <GraduationCap className="h-4 w-4" />
              Credenciais formadores (CC/CCP)
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Propostas recentes</CardTitle>
          {!loading && propostas.length > 0 && (
            <Badge variant="default">{propostas.length} total</Badge>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <DataTable
            columns={COLS}
            data={recentes}
            keyField="id"
            loading={loading}
            emptyMessage="Sem propostas - crie a primeira no módulo Propostas."
            onRowClick={(p) => {
              window.location.href = `/portal/propostas?highlight=${p.id}`;
            }}
          />
        </CardContent>
      </Card>
    </>
  );
}

function KpiCard({
  icon,
  label,
  value,
  sub,
  loading,
  isCurrency,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub: string;
  loading?: boolean;
  isCurrency?: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-start justify-between mb-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
          {icon}
        </div>
        <p className={`font-bold text-slate-100 ${isCurrency ? "text-xl" : "text-2xl"}`}>
          {loading ? "…" : value}
        </p>
        <p className="text-xs text-slate-500 mt-1">{sub}</p>
      </CardContent>
    </Card>
  );
}
