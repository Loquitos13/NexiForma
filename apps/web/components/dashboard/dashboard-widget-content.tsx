"use client";

import type { RelatorioDashboard, RelatorioKpi } from "@nexiforma/shared";
import type { WidgetWidthCols } from "@/lib/dashboard/widget-catalog";
import { sliceSeriePorPeriodo, type PeriodoComparacao } from "@/lib/relatorios/period-filter";
import { deltaColor, fmtDelta, fmtKpiValor } from "@/components/relatorios/format";
import { cn } from "@/lib/ui/cn";
import {
  FunilBarChart,
  OrigemPieChart,
  PipelineEuroChart,
  SerieCountChart,
  SerieEuroChart,
} from "@/components/relatorios/charts";
import { ConversaoPropostasFunnelCompact } from "@/components/relatorios/conversao-propostas-card";
import { DashboardIaSugestoesWidget } from "@/components/dashboard/dashboard-ia-sugestoes-widget";
import { ChartInsightBlurb } from "@/components/relatorios/chart-insight-blurb";

type Props = {
  widgetId: string;
  data: RelatorioDashboard;
  sliderWidthCols: WidgetWidthCols;
  enterprise: boolean;
  periodo?: PeriodoComparacao;
  getDescricao?: (titulo: string) => string | null;
  insightLoading?: boolean;
  insightTitulo?: string;
};

function SingleKpi({
  kpi,
  accent,
  compact,
}: {
  kpi: RelatorioKpi | undefined;
  accent: string;
  compact?: boolean;
}) {
  if (!kpi) return <p className="text-xs text-slate-500">Sem dados.</p>;
  const v = kpi.comparacoes.mesAnterior;
  return (
    <div className="flex h-full flex-col justify-center">
      <p className={cn("font-bold tabular-nums text-slate-50", compact ? "text-xl" : "text-2xl", accent)}>
        {fmtKpiValor(kpi)}
      </p>
      <p className={cn("mt-2 text-sm font-semibold tabular-nums", deltaColor(v.deltaPct))}>
        {fmtDelta(v.deltaPct)} <span className="text-[10px] font-normal text-slate-600">vs mês ant.</span>
      </p>
    </div>
  );
}

function findKpi(kpis: RelatorioKpi[], id: string) {
  return kpis.find((k) => k.id === id);
}

const CHART_INSIGHT: Record<string, string> = {
  "fin-chart-faturacao": "Evolução da faturação (12 meses)",
  "fin-chart-estados": "Faturas por estado",
  "com-chart-leads": "Leads e propostas (12 meses)",
  "com-chart-funil-leads": "Funil de leads",
  "com-chart-funil-propostas": "Funil de propostas",
  "com-chart-pipeline": "Pipeline estimado",
  "com-chart-origem": "Leads por origem",
  "emp-chart-matriculas": "Novas matrículas (12 meses)",
  "emp-chart-acoes": "Acções formativas por estado",
};

export function DashboardWidgetContent({
  widgetId,
  data,
  sliderWidthCols,
  enterprise,
  periodo = "mes",
  getDescricao,
  insightLoading,
  insightTitulo,
}: Props) {
  const fin = data.financeiro;
  const com = data.comercial;
  const emp = data.empresarial;
  const compact = sliderWidthCols <= 4;
  const chartProps = { fillContainer: true, widthCols: sliderWidthCols, title: "" as string };
  const insightKey = CHART_INSIGHT[widgetId];
  const insightTitle = insightTitulo ?? insightKey;

  let body: React.ReactNode = null;

  switch (widgetId) {
    case "fin-kpi-faturado":
      body = <SingleKpi kpi={findKpi(fin.kpis, "faturado")} accent="text-emerald-400" compact={compact} />;
      break;
    case "fin-kpi-faturas":
      body = <SingleKpi kpi={findKpi(fin.kpis, "faturas")} accent="text-emerald-400" compact={compact} />;
      break;
    case "fin-kpi-ticket":
      body = <SingleKpi kpi={findKpi(fin.kpis, "ticket")} accent="text-emerald-400" compact={compact} />;
      break;
    case "fin-kpi-acumulado":
      body = <SingleKpi kpi={findKpi(fin.kpis, "ano")} accent="text-emerald-400" compact={compact} />;
      break;
    case "fin-chart-faturacao":
      body = (
        <SerieEuroChart {...chartProps} serie={fin.serieMensal} serieSecundaria={fin.serieIva} secLabel="IVA" />
      );
      break;
    case "fin-chart-estados":
      body = <FunilBarChart {...chartProps} funil={fin.distribuicaoEstado} euro />;
      break;
    case "com-kpi-pipeline":
      body = <SingleKpi kpi={findKpi(com.kpis, "pipeline")} accent="text-blue-400" compact={compact} />;
      break;
    case "com-kpi-conversao":
      body = <SingleKpi kpi={findKpi(com.kpis, "taxa_conv_total")} accent="text-blue-400" compact={compact} />;
      break;
    case "com-kpi-propostas":
      body = <SingleKpi kpi={findKpi(com.kpis, "aceites")} accent="text-blue-400" compact={compact} />;
      break;
    case "com-ia-sugestoes":
      body = enterprise ? (
        <DashboardIaSugestoesWidget compact={compact} />
      ) : (
        <p className="text-xs text-slate-500">Disponível no plano Enterprise.</p>
      );
      break;
    case "com-ind-conversao":
      body = <ConversaoPropostasFunnelCompact conversao={com.conversaoPropostas} />;
      break;
    case "com-chart-leads":
      body = (
        <SerieCountChart
          {...chartProps}
          series={[
            { key: "leads", label: "Leads", data: com.serieLeads, color: "#60a5fa" },
            { key: "propostas", label: "Propostas", data: com.seriePropostas, color: "#34d399" },
          ]}
        />
      );
      break;
    case "com-chart-funil-leads":
      body = <FunilBarChart {...chartProps} funil={com.funilLeads} euro />;
      break;
    case "com-chart-funil-propostas":
      body = <FunilBarChart {...chartProps} funil={com.funilPropostas} euro />;
      break;
    case "com-chart-pipeline":
      body = <PipelineEuroChart {...chartProps} serie={com.seriePipeline} />;
      break;
    case "com-chart-origem":
      body = <OrigemPieChart {...chartProps} items={com.origemLeads} />;
      break;
    case "emp-kpi-matriculas":
      body = <SingleKpi kpi={findKpi(emp.kpis, "matriculas")} accent="text-violet-400" compact={compact} />;
      break;
    case "emp-kpi-conclusoes":
      body = <SingleKpi kpi={findKpi(emp.kpis, "conclusoes")} accent="text-violet-400" compact={compact} />;
      break;
    case "emp-kpi-taxa":
      body = <SingleKpi kpi={findKpi(emp.kpis, "taxa_conclusao")} accent="text-violet-400" compact={compact} />;
      break;
    case "emp-kpi-acoes":
      body = <SingleKpi kpi={findKpi(emp.kpis, "acoes_curso")} accent="text-violet-400" compact={compact} />;
      break;
    case "emp-chart-matriculas":
      body = (
        <SerieCountChart
          {...chartProps}
          series={[
            {
              key: "mat",
              label: "Matrículas",
              data: sliceSeriePorPeriodo(emp.serieMatriculas, periodo),
              color: "#a78bfa",
            },
          ]}
        />
      );
      break;
    case "emp-chart-acoes":
      body = <FunilBarChart {...chartProps} funil={emp.acoesPorEstado} />;
      break;
    case "emp-ind-compliance":
      body = (
        <dl className="grid h-full grid-cols-2 gap-2 content-center">
          {[
            { label: "CC (30d)", value: emp.compliance.formadoresCcExpirar30d, warn: emp.compliance.formadoresCcExpirar30d > 0 },
            { label: "SIGO pend.", value: emp.compliance.sigoPendentes, warn: emp.compliance.sigoPendentes > 0 },
            { label: "SIGO rej.", value: emp.compliance.sigoRejeitadas, warn: emp.compliance.sigoRejeitadas > 0 },
            {
              label: "Quiz",
              value: emp.compliance.taxaAprovacaoQuiz != null ? `${emp.compliance.taxaAprovacaoQuiz}%` : "-",
            },
          ].map((m) => (
            <div key={m.label} className="rounded-md border border-slate-700/40 bg-slate-950/40 px-2 py-1.5">
              <dt className="text-[9px] uppercase text-slate-500">{m.label}</dt>
              <dd className={cn("text-base font-semibold tabular-nums", m.warn ? "text-amber-400" : "text-slate-100")}>
                {m.value}
              </dd>
            </div>
          ))}
        </dl>
      );
      break;
    default:
      body = <p className="text-xs text-slate-500">Widget desconhecido.</p>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-hidden">{body}</div>
      {enterprise && insightKey && getDescricao ? (
        <ChartInsightBlurb
          enterprise
          loading={insightLoading}
          titulo={insightTitle ?? widgetId}
          descricao={getDescricao(insightKey)}
          className="mt-1 shrink-0 scale-90 origin-bottom"
        />
      ) : null}
    </div>
  );
}
