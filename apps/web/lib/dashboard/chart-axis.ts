import type { WidgetWidthCols } from "./widget-catalog";

/** Eixos e densidade conforme largura fixa do widget (colunas /12). */
export function chartAxisForWidth(widthCols: WidgetWidthCols) {
  const narrow = widthCols <= 4;
  const medium = widthCols <= 6;
  return {
    xInterval: narrow ? 2 : medium ? 1 : 0,
    yWidth: narrow ? 32 : medium ? 40 : 48,
    tickFontSize: narrow ? 9 : 10,
    yAxisCategoryWidth: narrow ? 56 : medium ? 72 : 88,
    showLegend: widthCols >= 6,
    hideLegend: widthCols <= 4,
    angle: narrow ? -25 : medium ? -15 : 0,
    xHeight: narrow ? 48 : medium ? 36 : 24,
  };
}

export function widgetWidthPercent(widthCols: WidgetWidthCols): string {
  return `${(widthCols / 12) * 100}%`;
}
