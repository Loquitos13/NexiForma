"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  RelatorioAgingBucket,
  RelatorioFluxoCaixa,
  RelatorioFunil,
  RelatorioFunilEtapa,
  RelatorioSerieMensal,
} from "@nexiforma/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { fmtEuro } from "@/lib/crm/shared";
import { cn } from "@/lib/ui/cn";
import { chartAxisForWidth } from "@/lib/dashboard/chart-axis";
import type { WidgetWidthCols } from "@/lib/dashboard/widget-catalog";
import { centavosToEuro } from "./format";

const CHART_COLORS = ["#60a5fa", "#34d399", "#a78bfa", "#fbbf24", "#f87171", "#2dd4bf"];

export type ChartSize = "compact" | "default";

function chartShellHeight(size: ChartSize | undefined, tier: "xl" | "lg" | "md"): string {
  const map = {
    default: { xl: "h-72", lg: "h-64", md: "h-56" },
    compact: { xl: "h-52", lg: "h-48", md: "h-44" },
  };
  return map[size ?? "default"][tier];
}

/** Evita focus no SVG ao clicar (Recharts v3 accessibilityLayer + tabIndex=0). */
const CHART_A11Y_OFF = { accessibilityLayer: false } as const;

function ChartShell({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={`nexiforma-chart w-full select-none outline-none [&_.recharts-active-dot]:outline-none [&_.recharts-surface]:outline-none [&_.recharts-wrapper]:outline-none ${className ?? ""}`}
      onMouseDown={(e) => e.preventDefault()}
    >
      {children}
    </div>
  );
}

const tooltipStyle = {
  contentStyle: {
    background: "rgba(15, 23, 42, 0.95)",
    border: "1px solid rgba(51, 65, 85, 0.6)",
    borderRadius: "8px",
    fontSize: "12px",
  },
  labelStyle: { color: "#94a3b8" },
};

function ChartTooltipEuro({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value?: number; name?: string; color?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-700/60 bg-slate-950/95 px-3 py-2 text-xs shadow-xl">
      <p className="mb-1 font-medium text-slate-300">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="tabular-nums">
          {p.name}: {fmtEuro(Math.round((p.value ?? 0) * 100))}
        </p>
      ))}
    </div>
  );
}

function ChartTooltipNum({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value?: number; name?: string; color?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-700/60 bg-slate-950/95 px-3 py-2 text-xs shadow-xl">
      <p className="mb-1 font-medium text-slate-300">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="tabular-nums">
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
}

export function SerieEuroChart({
  title,
  serie,
  serieSecundaria,
  secLabel = "IVA",
  embedded = false,
  chartSize,
  fillContainer = false,
  widthCols,
}: {
  title: string;
  serie: RelatorioSerieMensal[];
  serieSecundaria?: RelatorioSerieMensal[];
  secLabel?: string;
  embedded?: boolean;
  chartSize?: ChartSize;
  fillContainer?: boolean;
  widthCols?: WidgetWidthCols;
}) {
  const axis = widthCols ? chartAxisForWidth(widthCols) : null;
  const data = serie.map((s, i) => ({
    label: s.label,
    faturacao: centavosToEuro(s.valor),
    secundario: serieSecundaria ? centavosToEuro(serieSecundaria[i]?.valor ?? 0) : undefined,
  }));

  const chart = (
    <ChartShell className={cn(fillContainer ? "h-full w-full" : "w-full", !fillContainer && chartShellHeight(chartSize, "xl"))}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          {...CHART_A11Y_OFF}
          data={data}
          margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="fatGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#60a5fa" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />
          <XAxis
            dataKey="label"
            tick={{ fill: "#64748b", fontSize: axis?.tickFontSize ?? 10 }}
            interval={axis?.xInterval ?? 1}
            angle={axis?.angle ?? 0}
            height={axis?.xHeight ?? 30}
          />
          <YAxis
            tick={{ fill: "#64748b", fontSize: axis?.tickFontSize ?? 10 }}
            tickFormatter={(v) => `${v}€`}
            width={axis?.yWidth ?? 48}
          />
          <Tooltip content={<ChartTooltipEuro />} cursor={false} trigger="hover" />
          {!axis?.hideLegend ? (
            <Legend wrapperStyle={{ fontSize: 10, color: "#94a3b8" }} />
          ) : null}
          <Area
            type="monotone"
            dataKey="faturacao"
            name="Faturação"
            stroke="#60a5fa"
            fill="url(#fatGrad)"
            strokeWidth={2}
            activeDot={{ r: 4, strokeWidth: 2, stroke: "#60a5fa", fill: "#0f172a" }}
          />
          {serieSecundaria ? (
            <Line
              type="monotone"
              dataKey="secundario"
              name={secLabel}
              stroke="#34d399"
              strokeWidth={2}
              dot={false}
            />
          ) : null}
        </AreaChart>
      </ResponsiveContainer>
    </ChartShell>
  );

  if (embedded || fillContainer) return chart;

  return (
    <Card>
      {title ? (
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
      ) : null}
      <CardContent>{chart}</CardContent>
    </Card>
  );
}

export function SerieCountChart({
  title,
  series,
  chartSize,
  fillContainer = false,
  widthCols,
}: {
  title: string;
  series: { key: string; label: string; data: RelatorioSerieMensal[]; color: string }[];
  chartSize?: ChartSize;
  fillContainer?: boolean;
  widthCols?: WidgetWidthCols;
}) {
  const axis = widthCols ? chartAxisForWidth(widthCols) : null;
  const labels = series[0]?.data.map((d) => d.label) ?? [];
  const data = labels.map((label, i) => {
    const row: Record<string, string | number> = { label };
    for (const s of series) {
      row[s.key] = s.data[i]?.valor ?? 0;
    }
    return row;
  });

  const chart = (
    <ChartShell className={cn(fillContainer ? "h-full w-full" : "w-full", !fillContainer && chartShellHeight(chartSize, "xl"))}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart {...CHART_A11Y_OFF} data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />
          <XAxis
            dataKey="label"
            tick={{ fill: "#64748b", fontSize: axis?.tickFontSize ?? 10 }}
            interval={axis?.xInterval ?? 1}
            angle={axis?.angle ?? 0}
            height={axis?.xHeight ?? 30}
          />
          <YAxis tick={{ fill: "#64748b", fontSize: axis?.tickFontSize ?? 10 }} width={axis?.yWidth ?? 32} />
          <Tooltip content={<ChartTooltipNum />} cursor={false} trigger="hover" />
          {!axis?.hideLegend ? <Legend wrapperStyle={{ fontSize: 10, color: "#94a3b8" }} /> : null}
          {series.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={2}
              dot={{ r: 2, strokeWidth: 0 }}
              activeDot={{ r: 4, strokeWidth: 2, stroke: s.color, fill: "#0f172a" }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartShell>
  );

  if (fillContainer) return chart;

  return (
    <Card>
      {title ? (
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
      ) : null}
      <CardContent className={title ? undefined : "pt-4"}>{chart}</CardContent>
    </Card>
  );
}

export function FunilBarChart({
  title,
  funil,
  euro = false,
  chartSize,
  fillContainer = false,
  widthCols,
}: {
  title: string;
  funil: RelatorioFunil[];
  euro?: boolean;
  chartSize?: ChartSize;
  fillContainer?: boolean;
  widthCols?: WidgetWidthCols;
}) {
  const axis = widthCols ? chartAxisForWidth(widthCols) : null;
  const data = funil
    .filter((f) => f.quantidade > 0 || f.valorCentavos > 0)
    .map((f) => ({
      name: f.label,
      quantidade: f.quantidade,
      valor: centavosToEuro(f.valorCentavos),
    }));

  const chart = (
    <ChartShell className={cn(fillContainer ? "h-full w-full" : "w-full", !fillContainer && chartShellHeight(chartSize, "lg"))}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart {...CHART_A11Y_OFF} data={data} layout="vertical" margin={{ top: 2, right: 8, left: 0, bottom: 2 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} horizontal={false} />
          <XAxis type="number" tick={{ fill: "#64748b", fontSize: axis?.tickFontSize ?? 10 }} />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fill: "#94a3b8", fontSize: axis?.tickFontSize ?? 10 }}
            width={axis?.yAxisCategoryWidth ?? 88}
          />
          <Tooltip {...tooltipStyle} cursor={false} trigger="hover" />
          <Bar dataKey="quantidade" name="Qtd" fill="#60a5fa" radius={[0, 4, 4, 0]} />
          {euro && widthCols && widthCols >= 8 ? (
            <Bar dataKey="valor" name="Valor (€)" fill="#34d399" radius={[0, 4, 4, 0]} />
          ) : null}
        </BarChart>
      </ResponsiveContainer>
    </ChartShell>
  );

  if (fillContainer) return chart;

  return (
    <Card>
      {title ? (
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
      ) : null}
      <CardContent className={title ? undefined : "pt-4"}>{chart}</CardContent>
    </Card>
  );
}

export function OrigemPieChart({
  title,
  items,
  chartSize,
  fillContainer = false,
  widthCols,
}: {
  title: string;
  items: { label: string; quantidade: number }[];
  chartSize?: ChartSize;
  fillContainer?: boolean;
  widthCols?: WidgetWidthCols;
}) {
  const data = items.filter((i) => i.quantidade > 0);
  const inner = widthCols && widthCols <= 4 ? 28 : widthCols && widthCols <= 6 ? 36 : 48;
  const outer = widthCols && widthCols <= 4 ? 52 : widthCols && widthCols <= 6 ? 64 : 80;
  const hideLegend = widthCols != null && widthCols <= 4;

  const chart = (
    <ChartShell className={cn(fillContainer ? "h-full w-full" : "w-full", !fillContainer && chartShellHeight(chartSize, "lg"))}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart {...CHART_A11Y_OFF}>
          <Pie
            data={data}
            dataKey="quantidade"
            nameKey="label"
            cx="50%"
            cy="50%"
            innerRadius={inner}
            outerRadius={outer}
            paddingAngle={2}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip {...tooltipStyle} cursor={false} trigger="hover" />
          {!hideLegend ? <Legend wrapperStyle={{ fontSize: 10, color: "#94a3b8" }} /> : null}
        </PieChart>
      </ResponsiveContainer>
    </ChartShell>
  );

  if (fillContainer) return chart;

  return (
    <Card>
      {title ? (
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
      ) : null}
      <CardContent className={title ? undefined : "pt-4"}>{chart}</CardContent>
    </Card>
  );
}

export function PipelineEuroChart({
  title,
  serie,
  chartSize,
  fillContainer = false,
  widthCols,
}: {
  title: string;
  serie: RelatorioSerieMensal[];
  chartSize?: ChartSize;
  fillContainer?: boolean;
  widthCols?: WidgetWidthCols;
}) {
  const axis = widthCols ? chartAxisForWidth(widthCols) : null;
  const data = serie.map((s) => ({
    label: s.label,
    pipeline: centavosToEuro(s.valor),
  }));

  const chart = (
    <ChartShell className={cn(fillContainer ? "h-full w-full" : "w-full", !fillContainer && chartShellHeight(chartSize, "md"))}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart {...CHART_A11Y_OFF} data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />
          <XAxis
            dataKey="label"
            tick={{ fill: "#64748b", fontSize: axis?.tickFontSize ?? 10 }}
            interval={axis?.xInterval ?? 1}
            angle={axis?.angle ?? 0}
            height={axis?.xHeight ?? 30}
          />
          <YAxis
            tick={{ fill: "#64748b", fontSize: axis?.tickFontSize ?? 10 }}
            tickFormatter={(v) => `${v}€`}
            width={axis?.yWidth ?? 40}
          />
          <Tooltip content={<ChartTooltipEuro />} cursor={false} trigger="hover" />
          <Bar dataKey="pipeline" name="Pipeline" fill="#a78bfa" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartShell>
  );

  if (fillContainer) return chart;

  return (
    <Card>
      {title ? (
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
      ) : null}
      <CardContent className={title ? undefined : "pt-4"}>{chart}</CardContent>
    </Card>
  );
}

export function FluxoCaixaChart({ fluxo }: { fluxo: RelatorioFluxoCaixa }) {
  const data = [
    { label: "30 dias", valor: centavosToEuro(fluxo.dias30.receberCentavos), docs: fluxo.dias30.numDocumentos },
    { label: "60 dias", valor: centavosToEuro(fluxo.dias60.receberCentavos), docs: fluxo.dias60.numDocumentos },
    { label: "90 dias", valor: centavosToEuro(fluxo.dias90.receberCentavos), docs: fluxo.dias90.numDocumentos },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fluxo de caixa projetado (recebíveis)</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartShell className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart {...CHART_A11Y_OFF} data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />
              <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 10 }} />
              <YAxis tick={{ fill: "#64748b", fontSize: 10 }} tickFormatter={(v) => `${v}€`} width={52} />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const docs = payload[0]?.payload?.docs as number;
                  return (
                    <div className="rounded-lg border border-slate-700/60 bg-slate-950/95 px-3 py-2 text-xs">
                      <p className="font-medium text-slate-300">{label}</p>
                      <p className="text-emerald-400">{fmtEuro(Math.round(Number(payload[0]?.value ?? 0) * 100))}</p>
                      <p className="text-slate-400">{docs} documento(s)</p>
                    </div>
                  );
                }}
                cursor={false}
                trigger="hover"
              />
              <Bar dataKey="valor" name="A receber" fill="#34d399" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartShell>
      </CardContent>
    </Card>
  );
}

export function AgingBarChart({ aging }: { aging: RelatorioAgingBucket[] }) {
  const data = aging.map((a) => ({
    label: a.label,
    valor: centavosToEuro(a.valorCentavos),
    q: a.quantidade,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Aging de recebíveis</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartShell className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart {...CHART_A11Y_OFF} data={data} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />
              <XAxis type="number" tick={{ fill: "#64748b", fontSize: 10 }} tickFormatter={(v) => `${v}€`} />
              <YAxis type="category" dataKey="label" tick={{ fill: "#64748b", fontSize: 10 }} width={72} />
              <Tooltip content={<ChartTooltipEuro />} cursor={false} trigger="hover" />
              <Bar dataKey="valor" name="Valor" fill="#60a5fa" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartShell>
      </CardContent>
    </Card>
  );
}

export function FunilEtapasChart({ title, etapas }: { title: string; etapas: RelatorioFunilEtapa[] }) {
  const data = etapas.map((e) => ({
    label: e.label,
    quantidade: e.quantidade,
    conv: e.taxaConversaoPct ?? 0,
  }));

  return (
    <Card>
      {title ? (
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
      ) : null}
      <CardContent className={title ? undefined : "pt-4"}>
        <ChartShell className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart {...CHART_A11Y_OFF} data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />
              <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 9 }} interval={0} angle={-12} textAnchor="end" height={56} />
              <YAxis yAxisId="q" tick={{ fill: "#64748b", fontSize: 10 }} width={32} />
              <YAxis yAxisId="p" orientation="right" tick={{ fill: "#64748b", fontSize: 10 }} unit="%" width={40} />
              <Tooltip content={<ChartTooltipNum />} cursor={false} trigger="hover" />
              <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />
              <Bar yAxisId="q" dataKey="quantidade" name="Quantidade" fill="#60a5fa" radius={[4, 4, 0, 0]} />
              <Line yAxisId="p" type="monotone" dataKey="conv" name="Conv. (%)" stroke="#fbbf24" strokeWidth={2} dot />
            </BarChart>
          </ResponsiveContainer>
        </ChartShell>
        <ul className="mt-3 space-y-1 text-xs text-slate-500">
          {etapas
            .filter((e) => e.taxaConversaoPct != null)
            .map((e) => (
              <li key={e.etapa}>
                {e.label}: {e.taxaConversaoPct}% conversão
                {e.taxaAbandonoPct != null ? ` · ${e.taxaAbandonoPct}% abandono` : ""}
              </li>
            ))}
        </ul>
      </CardContent>
    </Card>
  );
}
