"use client";

import {
  Building2,
  Euro,
  GraduationCap,
  Receipt,
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
import { ReportInsightsPanel } from "./insights-panel";
import { ConversaoPropostasCard } from "./conversao-propostas-card";
import {
  ComercialAvancadoSection,
  EmpresarialAvancadoSection,
  FinanceiroAvancadoSection,
} from "./avancados";
import { ReportKpiCard } from "./kpi-card";

type Tab = "financeiro" | "comercial" | "empresarial";

type Props = {
  data: RelatorioDashboard;
  tab: Tab;
};

export function RelatoriosTabFinanceiro({ data }: { data: RelatorioDashboard }) {
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
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {fin.kpis.map((kpi) => (
          <ReportKpiCard
            key={kpi.id}
            kpi={kpi}
            icon={<Euro className="h-4 w-4" />}
            accent="text-emerald-400"
          />
        ))}
      </div>

      <ReportInsightsPanel secao="financeiro" />

      <div className="grid gap-6 xl:grid-cols-2">
        <SerieEuroChart
          title="Evolução da faturação (12 meses)"
          serie={fin.serieMensal}
          serieSecundaria={fin.serieIva}
          secLabel="IVA"
        />
        <FunilBarChart title="Faturas por estado" funil={fin.distribuicaoEstado} euro />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Top clientes por faturação (ano)</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            keyField="entidadeClienteId"
            columns={topCols}
            data={fin.topClientes}
            emptyMessage="Sem faturação registada."
          />
        </CardContent>
      </Card>

      <FinanceiroAvancadoSection avancado={fin.avancado} />
    </div>
  );
}

export function RelatoriosTabComercial({ data }: { data: RelatorioDashboard }) {
  const com = data.comercial;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {com.kpis.map((kpi) => (
          <ReportKpiCard
            key={kpi.id}
            kpi={kpi}
            icon={
              kpi.id === "pipeline" ? (
                <Target className="h-4 w-4" />
              ) : (
                <TrendingUp className="h-4 w-4" />
              )
            }
            accent="text-blue-400"
          />
        ))}
      </div>

      <ConversaoPropostasCard conversao={com.conversaoPropostas} />

      <ReportInsightsPanel secao="comercial" />

      <SerieCountChart
        title="Leads e propostas (12 meses)"
        series={[
          { key: "leads", label: "Leads", data: com.serieLeads, color: "#60a5fa" },
          { key: "propostas", label: "Propostas", data: com.seriePropostas, color: "#34d399" },
        ]}
      />

      <PipelineEuroChart title="Valor estimado de leads criados por mês" serie={com.seriePipeline} />

      <div className="grid gap-6 xl:grid-cols-2">
        <FunilBarChart title="Funil de leads" funil={com.funilLeads} euro />
        <FunilBarChart title="Funil de propostas" funil={com.funilPropostas} euro />
      </div>

      <OrigemPieChart title="Origem dos leads" items={com.origemLeads} />

      <ComercialAvancadoSection avancado={com.avancado} />
    </div>
  );
}

export function RelatoriosTabEmpresarial({ data }: { data: RelatorioDashboard }) {
  const emp = data.empresarial;
  const c = emp.compliance;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {emp.kpis.map((kpi) => (
          <ReportKpiCard
            key={kpi.id}
            kpi={kpi}
            icon={
              kpi.id === "matriculas" ? (
                <Users className="h-4 w-4" />
              ) : (
                <GraduationCap className="h-4 w-4" />
              )
            }
            accent="text-violet-400"
          />
        ))}
      </div>

      <ReportInsightsPanel secao="empresarial" />

      <SerieCountChart
        title="Novas matrículas (12 meses)"
        series={[{ key: "mat", label: "Matrículas", data: emp.serieMatriculas, color: "#a78bfa" }]}
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <FunilBarChart title="Acções formativas por estado" funil={emp.acoesPorEstado} />
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
              <MetricRow
                label="Taxa aprovação quiz"
                value={c.taxaAprovacaoQuiz != null ? `${c.taxaAprovacaoQuiz}%` : "-"}
              />
              <MetricRow label="CC formadores (30d)" value={String(c.formadoresCcExpirar30d)} warn={c.formadoresCcExpirar30d > 0} />
              <MetricRow label="SIGO pendentes" value={String(c.sigoPendentes)} warn={c.sigoPendentes > 0} />
              <MetricRow label="SIGO rejeitadas" value={String(c.sigoRejeitadas)} warn={c.sigoRejeitadas > 0} />
            </dl>
          </CardContent>
        </Card>
      </div>

      <EmpresarialAvancadoSection avancado={emp.avancado} />
    </div>
  );
}

function MetricRow({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-lg border border-slate-800/80 bg-slate-950/40 px-3 py-2.5">
      <dt className="text-[10px] uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className={`mt-1 text-lg font-semibold tabular-nums ${warn ? "text-amber-400" : "text-slate-100"}`}>
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

export function RelatoriosTabContent({ data, tab }: Props) {
  switch (tab) {
    case "financeiro":
      return <RelatoriosTabFinanceiro data={data} />;
    case "comercial":
      return <RelatoriosTabComercial data={data} />;
    case "empresarial":
      return <RelatoriosTabEmpresarial data={data} />;
  }
}
