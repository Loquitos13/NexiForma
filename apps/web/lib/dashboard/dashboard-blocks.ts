import type { DashboardCategory } from "./widget-catalog";
import type { WidgetWidthCols } from "./widget-catalog";

export type DashboardBlockKind = "slider" | "panel";

export type DashboardBlockId =
  | "slider-financeiro"
  | "slider-comercial"
  | "slider-empresarial"
  | "panel-formacao-resumo"
  | "panel-formacao-operacional"
  | "panel-atalhos";

export type DashboardBlockEntry = {
  id: DashboardBlockId;
  kind: DashboardBlockKind;
  label: string;
  category?: DashboardCategory;
  defaultWidthCols: WidgetWidthCols;
  /** Altura mínima do bloco (px) - sliders calculam dinamicamente */
  minHeightPx?: number;
};

export const DASHBOARD_BLOCKS: DashboardBlockEntry[] = [
  {
    id: "slider-financeiro",
    kind: "slider",
    label: "Financeiro",
    category: "financeiro",
    defaultWidthCols: 12,
  },
  {
    id: "slider-comercial",
    kind: "slider",
    label: "Comercial",
    category: "comercial",
    defaultWidthCols: 12,
  },
  {
    id: "slider-empresarial",
    kind: "slider",
    label: "Empresarial",
    category: "empresarial",
    defaultWidthCols: 12,
  },
  {
    id: "panel-formacao-resumo",
    kind: "panel",
    label: "Formação - resumo",
    defaultWidthCols: 8,
    minHeightPx: 140,
  },
  {
    id: "panel-formacao-operacional",
    kind: "panel",
    label: "Formação & compliance",
    defaultWidthCols: 8,
    minHeightPx: 320,
  },
  {
    id: "panel-atalhos",
    kind: "panel",
    label: "Atalhos",
    defaultWidthCols: 4,
    minHeightPx: 200,
  },
];

export const DEFAULT_BLOCK_IDS: DashboardBlockId[] = [
  "slider-financeiro",
  "slider-comercial",
  "slider-empresarial",
  "panel-formacao-resumo",
  "panel-formacao-operacional",
  "panel-atalhos",
];

export function getBlockEntry(id: string): DashboardBlockEntry | undefined {
  return DASHBOARD_BLOCKS.find((b) => b.id === id);
}

export function blockCategory(id: DashboardBlockId): DashboardCategory | undefined {
  return getBlockEntry(id)?.category;
}
