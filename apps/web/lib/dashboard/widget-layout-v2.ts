import {
  DEFAULT_WIDGET_IDS,
  getCatalogEntry,
  snapWidthCols,
  WIDGET_CATALOG,
  type DashboardCategory,
  type WidgetWidthCols,
} from "./widget-catalog";

export type WidgetLayoutItem = {
  id: string;
  widthCols: WidgetWidthCols;
  visible: boolean;
  order: number;
};

export type DashboardLayoutV2 = {
  version: 2;
  widgets: WidgetLayoutItem[];
};

function buildDefaultLayout(): DashboardLayoutV2 {
  const widgets: WidgetLayoutItem[] = [];
  let order = 0;
  for (const category of Object.keys(DEFAULT_WIDGET_IDS) as DashboardCategory[]) {
    for (const id of DEFAULT_WIDGET_IDS[category]) {
      const entry = getCatalogEntry(id);
      widgets.push({
        id,
        widthCols: entry?.defaultWidthCols ?? 8,
        visible: true,
        order: order++,
      });
    }
  }
  for (const entry of WIDGET_CATALOG) {
    if (!widgets.some((w) => w.id === entry.id)) {
      widgets.push({
        id: entry.id,
        widthCols: entry.defaultWidthCols,
        visible: false,
        order: widgets.length,
      });
    }
  }
  return { version: 2, widgets };
}

export const DEFAULT_DASHBOARD_LAYOUT = buildDefaultLayout();

export function widgetsForCategory(layout: DashboardLayoutV2, category: DashboardCategory): WidgetLayoutItem[] {
  return layout.widgets
    .filter((w) => {
      const entry = getCatalogEntry(w.id);
      return w.visible && entry?.category === category;
    })
    .sort((a, b) => a.order - b.order);
}

export function loadDashboardLayout(storageKey: string): DashboardLayoutV2 {
  if (typeof window === "undefined") return DEFAULT_DASHBOARD_LAYOUT;
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return DEFAULT_DASHBOARD_LAYOUT;
    const parsed = JSON.parse(raw) as DashboardLayoutV2;
    if (parsed?.version === 2 && Array.isArray(parsed.widgets)) {
      const merged = mergeCatalogWidgets({
        version: 2,
        widgets: parsed.widgets
          .filter((w) => getCatalogEntry(w.id))
          .map((w, i) => ({
            id: w.id,
            widthCols: snapWidthCols(w.widthCols ?? 8),
            visible: w.visible !== false,
            order: typeof w.order === "number" ? w.order : i,
          })),
      });
      return merged;
    }
    return DEFAULT_DASHBOARD_LAYOUT;
  } catch {
    return DEFAULT_DASHBOARD_LAYOUT;
  }
}

export function mergeCatalogWidgets(layout: DashboardLayoutV2): DashboardLayoutV2 {
  const existing = new Set(layout.widgets.map((w) => w.id));
  const extra: WidgetLayoutItem[] = [];
  for (const entry of WIDGET_CATALOG) {
    if (!existing.has(entry.id)) {
      extra.push({
        id: entry.id,
        widthCols: entry.defaultWidthCols,
        visible: false,
        order: layout.widgets.length + extra.length,
      });
    }
  }
  if (extra.length === 0) return layout;
  return { ...layout, widgets: [...layout.widgets, ...extra] };
}

export function saveDashboardLayout(storageKey: string, layout: DashboardLayoutV2) {
  if (typeof window === "undefined") return;
  localStorage.setItem(storageKey, JSON.stringify(layout));
}

export function updateWidgetWidth(
  layout: DashboardLayoutV2,
  widgetId: string,
  widthCols: WidgetWidthCols,
): DashboardLayoutV2 {
  return {
    ...layout,
    widgets: layout.widgets.map((w) => (w.id === widgetId ? { ...w, widthCols } : w)),
  };
}

export function toggleWidgetVisibility(
  layout: DashboardLayoutV2,
  widgetId: string,
  visible: boolean,
): DashboardLayoutV2 {
  return {
    ...layout,
    widgets: layout.widgets.map((w) => (w.id === widgetId ? { ...w, visible } : w)),
  };
}

export function reorderWidgetsInCategory(
  layout: DashboardLayoutV2,
  category: DashboardCategory,
  activeId: string,
  overId: string,
): DashboardLayoutV2 {
  const catWidgets = widgetsForCategory(layout, category);
  const from = catWidgets.findIndex((w) => w.id === activeId);
  const to = catWidgets.findIndex((w) => w.id === overId);
  if (from < 0 || to < 0 || from === to) return layout;

  const next = [...catWidgets];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);

  const orderMap = new Map(next.map((w, i) => [w.id, i]));
  const catIds = new Set(catWidgets.map((w) => w.id));

  return {
    ...layout,
    widgets: layout.widgets.map((w) => {
      if (!catIds.has(w.id)) return w;
      return { ...w, order: orderMap.get(w.id) ?? w.order };
    }),
  };
}

export function hiddenWidgetsForCategory(layout: DashboardLayoutV2, category: DashboardCategory): WidgetLayoutItem[] {
  return layout.widgets.filter((w) => {
    const entry = getCatalogEntry(w.id);
    return !w.visible && entry?.category === category;
  });
}
