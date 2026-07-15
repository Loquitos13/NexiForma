export type DashboardCategory = "financeiro" | "comercial" | "empresarial";

export type WidgetWidthCols = 4 | 6 | 8 | 12;

export type WidgetCatalogEntry = {
  id: string;
  category: DashboardCategory;
  label: string;
  kind: "indicador" | "grafico" | "ia";
  defaultWidthCols: WidgetWidthCols;
  heightPx: number;
  /** Só visível em plano Enterprise */
  enterpriseOnly?: boolean;
};

export const WIDGET_CATALOG: WidgetCatalogEntry[] = [
  // Financeiro
  { id: "fin-kpi-faturado", category: "financeiro", label: "Faturação do mês", kind: "indicador", defaultWidthCols: 4, heightPx: 132 },
  { id: "fin-kpi-faturas", category: "financeiro", label: "N.º faturas", kind: "indicador", defaultWidthCols: 4, heightPx: 132 },
  { id: "fin-kpi-ticket", category: "financeiro", label: "Ticket médio", kind: "indicador", defaultWidthCols: 4, heightPx: 132 },
  { id: "fin-kpi-acumulado", category: "financeiro", label: "Acumulado ano", kind: "indicador", defaultWidthCols: 4, heightPx: 132 },
  { id: "fin-chart-faturacao", category: "financeiro", label: "Evolução da faturação", kind: "grafico", defaultWidthCols: 12, heightPx: 300 },
  { id: "fin-chart-estados", category: "financeiro", label: "Faturas por estado", kind: "grafico", defaultWidthCols: 8, heightPx: 280 },
  // Comercial
  { id: "com-kpi-pipeline", category: "comercial", label: "Pipeline aberto", kind: "indicador", defaultWidthCols: 4, heightPx: 132 },
  { id: "com-kpi-conversao", category: "comercial", label: "Taxa conversão", kind: "indicador", defaultWidthCols: 4, heightPx: 132 },
  { id: "com-kpi-propostas", category: "comercial", label: "Propostas aceites", kind: "indicador", defaultWidthCols: 4, heightPx: 132 },
  { id: "com-ind-conversao", category: "comercial", label: "Funil propostas", kind: "indicador", defaultWidthCols: 8, heightPx: 200 },
  { id: "com-chart-leads", category: "comercial", label: "Leads e propostas", kind: "grafico", defaultWidthCols: 12, heightPx: 300 },
  { id: "com-chart-funil-leads", category: "comercial", label: "Funil de leads", kind: "grafico", defaultWidthCols: 6, heightPx: 280 },
  { id: "com-chart-funil-propostas", category: "comercial", label: "Funil de propostas", kind: "grafico", defaultWidthCols: 6, heightPx: 280 },
  { id: "com-chart-pipeline", category: "comercial", label: "Pipeline mensal", kind: "grafico", defaultWidthCols: 8, heightPx: 260 },
  { id: "com-chart-origem", category: "comercial", label: "Origem dos leads", kind: "grafico", defaultWidthCols: 6, heightPx: 260 },
  { id: "com-ia-sugestoes", category: "comercial", label: "Sugestões IA (CRM)", kind: "ia", defaultWidthCols: 8, heightPx: 240, enterpriseOnly: true },
  // Empresarial
  { id: "emp-kpi-matriculas", category: "empresarial", label: "Matrículas mês", kind: "indicador", defaultWidthCols: 4, heightPx: 132 },
  { id: "emp-kpi-conclusoes", category: "empresarial", label: "Conclusões", kind: "indicador", defaultWidthCols: 4, heightPx: 132 },
  { id: "emp-kpi-taxa", category: "empresarial", label: "Taxa conclusão", kind: "indicador", defaultWidthCols: 4, heightPx: 132 },
  { id: "emp-kpi-acoes", category: "empresarial", label: "Acções em curso", kind: "indicador", defaultWidthCols: 4, heightPx: 132 },
  { id: "emp-chart-matriculas", category: "empresarial", label: "Matrículas (série)", kind: "grafico", defaultWidthCols: 12, heightPx: 300 },
  { id: "emp-chart-acoes", category: "empresarial", label: "Acções por estado", kind: "grafico", defaultWidthCols: 8, heightPx: 280 },
  { id: "emp-ind-compliance", category: "empresarial", label: "Compliance", kind: "indicador", defaultWidthCols: 8, heightPx: 180 },
];

export const CATEGORY_LABELS: Record<DashboardCategory, string> = {
  financeiro: "Financeiro",
  comercial: "Comercial",
  empresarial: "Empresarial",
};

export const DEFAULT_WIDGET_IDS: Record<DashboardCategory, string[]> = {
  financeiro: ["fin-kpi-faturado", "fin-kpi-faturas", "fin-kpi-ticket", "fin-kpi-acumulado", "fin-chart-faturacao", "fin-chart-estados"],
  comercial: ["com-kpi-pipeline", "com-kpi-conversao", "com-ind-conversao", "com-ia-sugestoes", "com-chart-leads", "com-chart-funil-propostas"],
  empresarial: ["emp-kpi-matriculas", "emp-kpi-acoes", "emp-chart-matriculas", "emp-chart-acoes"],
};

export function getCatalogEntry(id: string): WidgetCatalogEntry | undefined {
  return WIDGET_CATALOG.find((w) => w.id === id);
}

export const WIDTH_STEPS: WidgetWidthCols[] = [4, 6, 8, 12];

export function snapWidthCols(cols: number): WidgetWidthCols {
  const sorted = [...WIDTH_STEPS];
  let best: WidgetWidthCols = 12;
  for (const s of sorted) {
    if (cols >= s) best = s;
  }
  return best;
}

export function nextWidthCols(current: WidgetWidthCols, direction: 1 | -1): WidgetWidthCols {
  const idx = WIDTH_STEPS.indexOf(current);
  const next = Math.max(0, Math.min(WIDTH_STEPS.length - 1, idx + direction));
  return WIDTH_STEPS[next] ?? current;
}
