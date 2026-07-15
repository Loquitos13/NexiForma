export type DashboardWidgetId = "financeiro" | "comercial" | "empresarial";

export type DashboardWidgetLayoutItem = {
  id: DashboardWidgetId;
  colSpan: 4 | 6 | 8 | 12;
  minHeight: number | null;
  visible: boolean;
  order: number;
};

export type DashboardWidgetLayout = DashboardWidgetLayoutItem[];

export const WIDGET_LABELS: Record<DashboardWidgetId, string> = {
  financeiro: "Financeiro",
  comercial: "Comercial",
  empresarial: "Empresarial",
};

export const DEFAULT_WIDGET_LAYOUT: DashboardWidgetLayout = [
  { id: "financeiro", colSpan: 12, minHeight: null, visible: true, order: 0 },
  { id: "comercial", colSpan: 12, minHeight: null, visible: true, order: 1 },
  { id: "empresarial", colSpan: 12, minHeight: null, visible: true, order: 2 },
];

const COL_SPANS: DashboardWidgetLayoutItem["colSpan"][] = [4, 6, 8, 12];

export function snapColSpan(value: number): DashboardWidgetLayoutItem["colSpan"] {
  const clamped = Math.max(4, Math.min(12, Math.round(value / 4) * 4)) as DashboardWidgetLayoutItem["colSpan"];
  return COL_SPANS.includes(clamped) ? clamped : 12;
}

export function loadWidgetLayout(storageKey: string): DashboardWidgetLayout {
  if (typeof window === "undefined") return DEFAULT_WIDGET_LAYOUT;
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return DEFAULT_WIDGET_LAYOUT;
    const parsed = JSON.parse(raw) as DashboardWidgetLayout;
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_WIDGET_LAYOUT;
    const ids = new Set<DashboardWidgetId>();
    return parsed
      .filter((w) => w.id && WIDGET_LABELS[w.id as DashboardWidgetId])
      .map((w, i) => ({
        id: w.id as DashboardWidgetId,
        colSpan: snapColSpan(w.colSpan ?? 12),
        minHeight: typeof w.minHeight === "number" ? Math.max(160, w.minHeight) : null,
        visible: w.visible !== false,
        order: typeof w.order === "number" ? w.order : i,
      }))
      .filter((w) => {
        if (ids.has(w.id)) return false;
        ids.add(w.id);
        return true;
      });
  } catch {
    return DEFAULT_WIDGET_LAYOUT;
  }
}

export function saveWidgetLayout(storageKey: string, layout: DashboardWidgetLayout) {
  if (typeof window === "undefined") return;
  localStorage.setItem(storageKey, JSON.stringify(layout));
}

export function mergeMissingWidgets(layout: DashboardWidgetLayout): DashboardWidgetLayout {
  const existing = new Set(layout.map((w) => w.id));
  const merged = [...layout];
  for (const def of DEFAULT_WIDGET_LAYOUT) {
    if (!existing.has(def.id)) merged.push({ ...def, order: merged.length });
  }
  return merged.sort((a, b) => a.order - b.order);
}
