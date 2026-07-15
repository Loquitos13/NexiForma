import {
  DEFAULT_WIDGET_IDS,
  getCatalogEntry,
  snapWidthCols,
  WIDGET_CATALOG,
  type DashboardCategory,
  type WidgetWidthCols,
} from "./widget-catalog";
import {
  DEFAULT_BLOCK_IDS,
  getBlockEntry,
  type DashboardBlockId,
} from "./dashboard-blocks";
import { loadDashboardLayout as loadV2, type DashboardLayoutV2 } from "./widget-layout-v2";

export type WidgetSlideItem = {
  id: string;
  visible: boolean;
  order: number;
};

export type DashboardBlockLayout = {
  id: DashboardBlockId;
  widthCols: WidgetWidthCols;
  visible: boolean;
  order: number;
};

export type DashboardLayoutV3 = {
  version: 3;
  blocks: DashboardBlockLayout[];
  widgets: WidgetSlideItem[];
};

function buildDefaultBlocks(): DashboardBlockLayout[] {
  return DEFAULT_BLOCK_IDS.map((id, order) => ({
    id,
    widthCols: getBlockEntry(id)?.defaultWidthCols ?? 12,
    visible: true,
    order,
  }));
}

function buildDefaultWidgets(): WidgetSlideItem[] {
  const widgets: WidgetSlideItem[] = [];
  let order = 0;
  for (const category of Object.keys(DEFAULT_WIDGET_IDS) as DashboardCategory[]) {
    for (const id of DEFAULT_WIDGET_IDS[category]) {
      widgets.push({ id, visible: true, order: order++ });
    }
  }
  for (const entry of WIDGET_CATALOG) {
    if (!widgets.some((w) => w.id === entry.id)) {
      widgets.push({ id: entry.id, visible: false, order: widgets.length });
    }
  }
  return widgets;
}

export const DEFAULT_DASHBOARD_LAYOUT_V3: DashboardLayoutV3 = {
  version: 3,
  blocks: buildDefaultBlocks(),
  widgets: buildDefaultWidgets(),
};

function migrateFromV2(v2: DashboardLayoutV2): DashboardLayoutV3 {
  const sliderWidths: Partial<Record<DashboardCategory, WidgetWidthCols>> = {};
  for (const cat of ["financeiro", "comercial", "empresarial"] as DashboardCategory[]) {
    const visible = v2.widgets.filter((w) => {
      const e = getCatalogEntry(w.id);
      return w.visible && e?.category === cat;
    });
    if (visible.length > 0) {
      sliderWidths[cat] = snapWidthCols(Math.max(...visible.map((w) => w.widthCols)));
    }
  }

  return {
    version: 3,
    blocks: buildDefaultBlocks().map((b) => {
      const cat = getBlockEntry(b.id)?.category;
      if (cat && sliderWidths[cat]) {
        return { ...b, widthCols: sliderWidths[cat]! };
      }
      return b;
    }),
    widgets: v2.widgets.map((w) => ({
      id: w.id,
      visible: w.visible,
      order: w.order,
    })),
  };
}

export function loadDashboardLayoutV3(storageKey: string): DashboardLayoutV3 {
  if (typeof window === "undefined") return DEFAULT_DASHBOARD_LAYOUT_V3;
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return DEFAULT_DASHBOARD_LAYOUT_V3;
    const parsed = JSON.parse(raw) as DashboardLayoutV3 | DashboardLayoutV2;
    if (parsed?.version === 3 && Array.isArray(parsed.blocks) && Array.isArray(parsed.widgets)) {
      return mergeLayoutV3(parsed);
    }
    if (parsed?.version === 2) {
      return mergeLayoutV3(migrateFromV2(parsed as DashboardLayoutV2));
    }
    return DEFAULT_DASHBOARD_LAYOUT_V3;
  } catch {
    return DEFAULT_DASHBOARD_LAYOUT_V3;
  }
}

function mergeLayoutV3(layout: DashboardLayoutV3): DashboardLayoutV3 {
  const blockIds = new Set(layout.blocks.map((b) => b.id));
  const extraBlocks = DEFAULT_BLOCK_IDS.filter((id) => !blockIds.has(id)).map((id, i) => ({
    id,
    widthCols: getBlockEntry(id)?.defaultWidthCols ?? 12,
    visible: false,
    order: layout.blocks.length + i,
  }));

  const widgetIds = new Set(layout.widgets.map((w) => w.id));
  const extraWidgets = WIDGET_CATALOG.filter((e) => !widgetIds.has(e.id)).map((e, i) => ({
    id: e.id,
    visible: false,
    order: layout.widgets.length + i,
  }));

  return {
    version: 3,
    blocks: [...layout.blocks, ...extraBlocks].map((b) => ({
      ...b,
      widthCols: snapWidthCols(b.widthCols ?? 12),
    })),
    widgets: [...layout.widgets, ...extraWidgets].filter((w) => getCatalogEntry(w.id)),
  };
}

export function saveDashboardLayoutV3(storageKey: string, layout: DashboardLayoutV3) {
  if (typeof window === "undefined") return;
  localStorage.setItem(storageKey, JSON.stringify(layout));
}

export function visibleBlocks(layout: DashboardLayoutV3): DashboardBlockLayout[] {
  return layout.blocks.filter((b) => b.visible).sort((a, b) => a.order - b.order);
}

export function hiddenBlocks(layout: DashboardLayoutV3): DashboardBlockLayout[] {
  return layout.blocks.filter((b) => !b.visible);
}

export function widgetsForCategory(layout: DashboardLayoutV3, category: DashboardCategory): WidgetSlideItem[] {
  return layout.widgets
    .filter((w) => {
      const entry = getCatalogEntry(w.id);
      return w.visible && entry?.category === category;
    })
    .sort((a, b) => a.order - b.order);
}

export function hiddenWidgetsForCategory(layout: DashboardLayoutV3, category: DashboardCategory): WidgetSlideItem[] {
  return layout.widgets.filter((w) => {
    const entry = getCatalogEntry(w.id);
    return !w.visible && entry?.category === category;
  });
}

export function updateBlockWidth(
  layout: DashboardLayoutV3,
  blockId: DashboardBlockId,
  widthCols: WidgetWidthCols,
): DashboardLayoutV3 {
  return {
    ...layout,
    blocks: layout.blocks.map((b) => (b.id === blockId ? { ...b, widthCols } : b)),
  };
}

export function toggleBlockVisibility(
  layout: DashboardLayoutV3,
  blockId: DashboardBlockId,
  visible: boolean,
): DashboardLayoutV3 {
  return {
    ...layout,
    blocks: layout.blocks.map((b) => (b.id === blockId ? { ...b, visible } : b)),
  };
}

export function toggleWidgetVisibility(
  layout: DashboardLayoutV3,
  widgetId: string,
  visible: boolean,
): DashboardLayoutV3 {
  return {
    ...layout,
    widgets: layout.widgets.map((w) => (w.id === widgetId ? { ...w, visible } : w)),
  };
}

export function reorderWidgetsInCategory(
  layout: DashboardLayoutV3,
  category: DashboardCategory,
  activeId: string,
  overId: string,
): DashboardLayoutV3 {
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

export function getBlockLayout(layout: DashboardLayoutV3, blockId: DashboardBlockId): DashboardBlockLayout | undefined {
  return layout.blocks.find((b) => b.id === blockId);
}
