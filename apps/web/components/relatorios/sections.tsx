"use client";

import Link from "next/link";
import {
  Building2,
  Euro,
  GraduationCap,
  Receipt,
  Sparkles,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import type { RelatorioDashboard } from "@nexiforma/shared";
import { Card, CardContent, CardHeader, CardTitle, DataTable, type Column } from "@/components/ui";
import { fmtEuro } from "@/lib/crm/shared";
import {
  FunilBarChart,
  OrigemPieChart,
  PipelineEuroChart,
  SerieCountChart,
  SerieEuroChart,
} from "./charts";
import { ChartWithEnterpriseInsight } from "./chart-with-insight";
import { ReportInsightsPanel } from "./insights-panel";
import { ConversaoPropostasCard } from "./conversao-propostas-card";
import {
  ComercialAvancadoSection,
  EmpresarialAvancadoSection,
  FinanceiroAvancadoSection,
} from "./avancados";
import { ReportKpiCard } from "./kpi-card";
import { PeriodComparisonFilter } from "./period-comparison-filter";
import { resumoKpisPeriodo, sliceSeriePorPeriodo, type PeriodoComparacao } from "@/lib/relatorios/period-filter";
import { deltaColor, fmtDelta, fmtKpiValor } from "./format";
import { cn } from "@/lib/ui/cn";
import { useState } from "react";

type Tab = "financeiro" | "comercial" | "empresarial";

type Props = {
  data: RelatorioDashboard;
  tab: Tab;
  enterprise?: boolean;
};

function BusinessUpgradeBanner() {
  return (
    <div className="rounded-xl border border-violet-500/25 bg-violet-950/20 px-4 py-3 text-sm text-slate-300">
      <p className="flex items-center gap-2 font-medium text-violet-200">
        <Sparkles className="h-4 w-4" />
        Plano Business
      </p>
      <p className="mt-1 text-xs text-slate-400">
        Tem dashboards e gráficos completos. Faça upgrade para{" "}
        <Link href="/portal/billing" className="text-blue-400 hover:underline">
          Enterprise
        </Link>{" "}
        para análise IA por gráfico, relatórios expandidos e exportação PDF inteligente.
      </p>
    </div>
  );
}

function KpiGridPeriodo({
  kpis,
  periodo,
  accent,
  icon,
}: {
  kpis: RelatorioDashboard["financeiro"]["kpis"];
  periodo: PeriodoComparacao;
  accent: string;
  icon?: (kpi: (typeof kpis)[0]) => React.ReactNode;
}) {
  const resumo = resumoKpisPeriodo(kpis, periodo);
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {resumo.map(({ kpi, comparacao, comparacaoLabel }) => (
        <div
          key={kpi.id}
          className="rounded-xl border border-slate-700/50 bg-slate-900/60 p-4 backdrop-blur-sm"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{kpi.label}</p>
            {icon?.(kpi)}
          </div>
          <p className={cn("mt-2 text-2xl font-bold tabular-nums text-slate-50", accent)}>
            {fmtKpiValor(kpi)}
          </p>
          <p className="mt-2 text-[10px] text-slate-600">{comparacaoLabel}</p>
          <p className={cn("text-sm font-semibold tabular-nums", deltaColor(comparacao.deltaPct))}>
            {fmtDelta(comparacao.deltaPct)}
          </p>
        </div>
      ))}
    </div>
  );
}

export function RelatoriosTabFinanceiro({ data, enterprise = false }: Omit<Props, "tab">) {
  const fin = data.financeiro;
  const topCols: Column<(typeof fin.topClientes)[0]>[] = [
    { key: "nome", header: "Cliente", cell: (r) => <span className="font-medium text-slate-100">{r.nome}</span> },
    {
      key: "faturado",
      header: "Faturado (ano)",
      cell: (r) => <span className="tabular-nums text-emerald-400">{fmtEuro(r.faturadoCentavos)}</span>,
    },
    { key: "n", header: "Faturas", cell: (r) => r.numFaturas },
  ];

  return (
    <div className="space-y-6">
      {!enterprise ? <BusinessUpgradeBanner /> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {fin.kpis.map((kpi) => (
          <ReportKpiCard key={kpi.id} kpi={kpi} icon={<Euro className="h-4 w-4" />} accent="text-emerald-400" />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartWithEnterpriseInsight secao="financeiro" tituloGrafico="Evolução da faturação (12 meses)" enterprise={enterprise}>
          <SerieEuroChart title="Evolução da faturação (12 meses)" serie={fin.serieMensal} serieSecundaria={fin.serieIva} secLabel="IVA" />
        </ChartWithEnterpriseInsight>
        <ChartWithEnterpriseInsight secao="financeiro" tituloGrafico="Faturas por estado" enterprise={enterprise}>
          <FunilBarChart title="Faturas por estado" funil={fin.distribuicaoEstado} euro />
        </ChartWithEnterpriseInsight>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Top clientes por faturação (ano)</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable keyField="entidadeClienteId" columns={topCols} data={fin.topClientes} emptyMessage="Sem faturação registada." />
        </CardContent>
      </Card>

      <FinanceiroAvancadoSection avancado={fin.avancado} />

      {enterprise ? <ReportInsightsPanel secao="financeiro" /> : null}
    </div>
  );
}

export function RelatoriosTabComercial({ data, enterprise = false }: Omit<Props, "tab">) {
  const com = data.comercial;

  return (
    <div className="space-y-6">
      {!enterprise ? <BusinessUpgradeBanner /> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {com.kpis.map((kpi) => (
          <ReportKpiCard
            key={kpi.id}
            kpi={kpi}
            icon={kpi.id === "pipeline" ? <Target className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
            accent="text-blue-400"
          />
        ))}
      </div>

      <ConversaoPropostasCard conversao={com.conversaoPropostas} />

      <ChartWithEnterpriseInsight secao="comercial" tituloGrafico="Leads e propostas (12 meses)" enterprise={enterprise}>
        <SerieCountChart
          title="Leads e propostas (12 meses)"
          series={[
            { key: "leads", label: "Leads", data: com.serieLeads, color: "#60a5fa" },
            { key: "propostas", label: "Propostas", data: com.seriePropostas, color: "#34d399" },
          ]}
        />
      </ChartWithEnterpriseInsight>

      <ChartWithEnterpriseInsight secao="comercial" tituloGrafico="Pipeline estimado" enterprise={enterprise}>
        <PipelineEuroChart title="Valor estimado de leads criados por mês" serie={com.seriePipeline} />
      </ChartWithEnterpriseInsight>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartWithEnterpriseInsight secao="comercial" tituloGrafico="Funil de leads" enterprise={enterprise}>
          <FunilBarChart title="Funil de leads" funil={com.funilLeads} euro />
        </ChartWithEnterpriseInsight>
        <ChartWithEnterpriseInsight secao="comercial" tituloGrafico="Funil de propostas" enterprise={enterprise}>
          <FunilBarChart title="Funil de propostas" funil={com.funilPropostas} euro />
        </ChartWithEnterpriseInsight>
      </div>

      <ChartWithEnterpriseInsight secao="comercial" tituloGrafico="Leads por origem" enterprise={enterprise}>
        <OrigemPieChart title="Origem dos leads" items={com.origemLeads} />
      </ChartWithEnterpriseInsight>

      <ComercialAvancadoSection avancado={com.avancado} />

      {enterprise ? <ReportInsightsPanel secao="comercial" /> : null}
    </div>
  );
}

export function RelatoriosTabEmpresarial({ data, enterprise = false }: Omit<Props, "tab">) {
  const emp = data.empresarial;
  const c = emp.compliance;
  const [periodo, setPeriodo] = useState<PeriodoComparacao>("mes");
  const serieMat = sliceSeriePorPeriodo(emp.serieMatriculas, periodo);

  return (
    <div className="space-y-6">
      {!enterprise ? <BusinessUpgradeBanner /> : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-500">Comparar indicadores por intervalo temporal</p>
        <PeriodComparisonFilter value={periodo} onChange={setPeriodo} />
      </div>

      <KpiGridPeriodo
        kpis={emp.kpis}
        periodo={periodo}
        accent="text-violet-400"
        icon={(kpi) =>
          kpi.id === "matriculas" ? (
            <Users className="h-4 w-4 text-violet-400 opacity-80" />
          ) : (
            <GraduationCap className="h-4 w-4 text-violet-400 opacity-80" />
          )
        }
      />

      <ChartWithEnterpriseInsight secao="empresarial" tituloGrafico="Novas matrículas (12 meses)" enterprise={enterprise}>
        <SerieCountChart
          title={`Novas matrículas (${periodo})`}
          series={[{ key: "mat", label: "Matrículas", data: serieMat, color: "#a78bfa" }]}
        />
      </ChartWithEnterpriseInsight>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartWithEnterpriseInsight secao="empresarial" tituloGrafico="Acções formativas por estado" enterprise={enterprise}>
          <FunilBarChart title="Acções formativas por estado" funil={emp.acoesPorEstado} />
        </ChartWithEnterpriseInsight>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-amber-400" />
              Compliance e operação
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 sm:grid-cols-2">
              <MetricRow label="Acções em curso" value={String(c.acoesEmCurso)} />
              <MetricRow label="Taxa aprovação quiz" value={c.taxaAprovacaoQuiz != null ? `${c.taxaAprovacaoQuiz}%` : "-"} />
              <MetricRow label="CC formadores (30d)" value={String(c.formadoresCcExpirar30d)} warn={c.formadoresCcExpirar30d > 0} />
              <MetricRow label="SIGO pendentes" value={String(c.sigoPendentes)} warn={c.sigoPendentes > 0} />
              <MetricRow label="SIGO rejeitadas" value={String(c.sigoRejeitadas)} warn={c.sigoRejeitadas > 0} />
            </dl>
          </CardContent>
        </Card>
      </div>

      <EmpresarialAvancadoSection avancado={emp.avancado} />

      {enterprise ? <ReportInsightsPanel secao="empresarial" /> : null}
    </div>
  );
}

function MetricRow({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-lg border border-slate-800/80 bg-slate-950/40 px-3 py-2.5">
      <dt className="text-[10px] uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className={cn("mt-1 text-lg font-semibold tabular-nums", warn ? "text-amber-400" : "text-slate-100")}>
        {value}
      </dd>
    </div>
  );
}

export const RELATORIO_TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "financeiro", label: "Financeiro", icon: <Receipt className="h-4 w-4" /> },
  { id: "comercial", label: "Comercial (CRM)", icon: <TrendingUp className="h-4 w-4" /> },
  { id: "empresarial", label: "Empresarial", icon: <Building2 className="h-4 w-4" /> },
];

export type { Tab as RelatorioTab };

export function RelatoriosTabContent({ data, tab, enterprise = false }: Props) {
  switch (tab) {
    case "financeiro":
      return <RelatoriosTabFinanceiro data={data} enterprise={enterprise} />;
    case "comercial":
      return <RelatoriosTabComercial data={data} enterprise={enterprise} />;
    case "empresarial":
      return <RelatoriosTabEmpresarial data={data} enterprise={enterprise} />;
  }
}
