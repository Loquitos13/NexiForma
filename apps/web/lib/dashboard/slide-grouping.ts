import { getCatalogEntry, type WidgetWidthCols } from "./widget-catalog";

export type WidgetSlideGroup = {
  widgetIds: string[];
  layout: "grid" | "single";
};

/** KPI compacto (4 colunas) - pode partilhar slide com outros. */
export function isCompactKpi(widgetId: string): boolean {
  const entry = getCatalogEntry(widgetId);
  if (!entry) return false;
  return entry.kind === "indicador" && entry.defaultWidthCols === 4 && entry.heightPx <= 140;
}

/** Gráficos, IA e indicadores largos ocupam slide inteiro. */
export function isFullSlideWidget(widgetId: string): boolean {
  return !isCompactKpi(widgetId);
}

/** Indicadores por fila consoante largura do slider (grid /12). */
export function kpiItemsPerRow(sliderWidthCols: WidgetWidthCols): number {
  if (sliderWidthCols >= 12) return 4;
  if (sliderWidthCols >= 8) return 2;
  if (sliderWidthCols >= 6) return 2;
  return 1;
}

/** Máximo de filas de KPIs empilhados por slide. */
export function kpiMaxRowsPerSlide(sliderWidthCols: WidgetWidthCols): number {
  if (sliderWidthCols >= 12) return 2;
  if (sliderWidthCols >= 8) return 2;
  return 2;
}

export function kpiMaxPerSlide(sliderWidthCols: WidgetWidthCols): number {
  return kpiItemsPerRow(sliderWidthCols) * kpiMaxRowsPerSlide(sliderWidthCols);
}

/**
 * Agrupa widgets visíveis em slides conforme a largura do slider.
 * KPIs compactos partilham slides; gráficos/IA têm slide próprio.
 */
export function groupWidgetsIntoSlides(
  widgetIds: string[],
  sliderWidthCols: WidgetWidthCols,
): WidgetSlideGroup[] {
  const groups: WidgetSlideGroup[] = [];
  let kpiBuffer: string[] = [];

  function flushKpiBuffer() {
    if (kpiBuffer.length === 0) return;
    const maxPerSlide = kpiMaxPerSlide(sliderWidthCols);
    while (kpiBuffer.length > 0) {
      const chunk = kpiBuffer.splice(0, maxPerSlide);
      groups.push({ widgetIds: chunk, layout: "grid" });
    }
  }

  for (const id of widgetIds) {
    if (isFullSlideWidget(id)) {
      flushKpiBuffer();
      groups.push({ widgetIds: [id], layout: "single" });
    } else {
      kpiBuffer.push(id);
    }
  }
  flushKpiBuffer();

  return groups;
}

const KPI_TILE_HEIGHT = 132;
const KPI_ROW_GAP = 8;
const SLIDE_PADDING = 8;

/** Altura fixa do slide (px) para o carrossel. */
export function slideHeightPx(
  group: WidgetSlideGroup,
  sliderWidthCols: WidgetWidthCols,
  editMode: boolean,
): number {
  const editChrome = editMode ? 28 : 0;

  if (group.layout === "grid") {
    const perRow = kpiItemsPerRow(sliderWidthCols);
    const rows = Math.ceil(group.widgetIds.length / perRow);
    return rows * KPI_TILE_HEIGHT + Math.max(0, rows - 1) * KPI_ROW_GAP + SLIDE_PADDING + editChrome;
  }

  const entry = getCatalogEntry(group.widgetIds[0]!);
  return (entry?.heightPx ?? 280) + SLIDE_PADDING + editChrome;
}

export function gridColsClass(sliderWidthCols: WidgetWidthCols): string {
  if (sliderWidthCols >= 12) return "grid-cols-4";
  if (sliderWidthCols >= 8) return "grid-cols-2";
  if (sliderWidthCols >= 6) return "grid-cols-2";
  return "grid-cols-1";
}
