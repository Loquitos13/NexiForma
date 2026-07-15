"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Plus } from "lucide-react";
import type { RelatorioDashboard } from "@nexiforma/shared";
import type { DashboardCategory } from "@/lib/dashboard/widget-catalog";
import { CATEGORY_LABELS, getCatalogEntry } from "@/lib/dashboard/widget-catalog";
import {
  hiddenWidgetsForCategory,
  reorderWidgetsInCategory,
  toggleWidgetVisibility,
  widgetsForCategory,
  type DashboardLayoutV3,
} from "@/lib/dashboard/widget-layout-v3";
import type { WidgetWidthCols } from "@/lib/dashboard/widget-catalog";
import { groupWidgetsIntoSlides, slideHeightPx } from "@/lib/dashboard/slide-grouping";
import { ContentCarousel } from "@/components/ui/content-carousel";
import { WidgetSlideView } from "@/components/dashboard/widget-slide-view";
import { DashboardWidgetContent } from "@/components/dashboard/dashboard-widget-content";
import { PeriodComparisonFilter } from "@/components/relatorios/period-comparison-filter";
import { useSectionChartInsights } from "@/components/relatorios/use-section-insights";
import type { PeriodoComparacao } from "@/lib/relatorios/period-filter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { cn } from "@/lib/ui/cn";

type Props = {
  category: DashboardCategory;
  data: RelatorioDashboard;
  layout: DashboardLayoutV3;
  sliderWidthCols: WidgetWidthCols;
  editMode: boolean;
  enterprise: boolean;
  reportHref: string;
  icon: React.ReactNode;
  borderClass: string;
  onLayoutChange: (next: DashboardLayoutV3) => void;
};

export function CategorySliderPanel({
  category,
  data,
  layout,
  sliderWidthCols,
  editMode,
  enterprise,
  reportHref,
  icon,
  borderClass,
  onLayoutChange,
}: Props) {
  const [periodo, setPeriodo] = useState<PeriodoComparacao>("mes");
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const dragIdRef = useRef<string | null>(null);

  const widgets = useMemo(
    () =>
      widgetsForCategory(layout, category).filter((w) => {
        const entry = getCatalogEntry(w.id);
        if (entry?.enterpriseOnly && !enterprise) return false;
        return true;
      }),
    [layout, category, enterprise],
  );

  const widgetIds = useMemo(() => widgets.map((w) => w.id), [widgets]);

  const slides = useMemo(
    () => groupWidgetsIntoSlides(widgetIds, sliderWidthCols),
    [widgetIds, sliderWidthCols],
  );

  const hidden = useMemo(
    () =>
      hiddenWidgetsForCategory(layout, category).filter((w) => {
        const entry = getCatalogEntry(w.id);
        if (entry?.enterpriseOnly && !enterprise) return false;
        return true;
      }),
    [layout, category, enterprise],
  );

  const insightsSecao =
    category === "financeiro" ? "financeiro" : category === "comercial" ? "comercial" : "empresarial";
  const { getDescricao, loading: insightLoading, visibleRef } = useSectionChartInsights(
    insightsSecao,
    enterprise,
    true,
  );

  useEffect(() => {
    setCarouselIndex((i) => Math.min(i, Math.max(0, slides.length - 1)));
  }, [slides.length, sliderWidthCols]);

  const activeSlide = slides[carouselIndex];
  const fixedHeight = activeSlide
    ? slideHeightPx(activeSlide, sliderWidthCols, editMode)
    : 200;

  const onDragStart = useCallback(
    (e: React.PointerEvent, widgetId: string) => {
      if (!editMode) return;
      e.preventDefault();
      e.stopPropagation();
      const handle = e.currentTarget;
      handle.setPointerCapture(e.pointerId);
      dragIdRef.current = widgetId;

      function targetFromPoint(x: number, y: number): string | null {
        const el = document.elementFromPoint(x, y)?.closest("[data-indicator-widget]");
        return el?.getAttribute("data-indicator-widget") ?? null;
      }

      function onMove(ev: PointerEvent) {
        setDropTargetId(targetFromPoint(ev.clientX, ev.clientY));
      }

      function onUp(ev: PointerEvent) {
        handle.releasePointerCapture(ev.pointerId);
        const active = dragIdRef.current;
        const over = targetFromPoint(ev.clientX, ev.clientY);
        dragIdRef.current = null;
        setDropTargetId(null);
        if (active && over && active !== over) {
          onLayoutChange(reorderWidgetsInCategory(layout, category, active, over));
        }
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      }

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [editMode, layout, category, onLayoutChange],
  );

  const renderWidget = useCallback(
    (widgetId: string) => (
      <DashboardWidgetContent
        widgetId={widgetId}
        data={data}
        sliderWidthCols={sliderWidthCols}
        enterprise={enterprise}
        periodo={periodo}
        getDescricao={getDescricao}
        insightLoading={insightLoading}
      />
    ),
    [data, sliderWidthCols, enterprise, periodo, getDescricao, insightLoading],
  );

  if (widgets.length === 0) {
  return (
    <div ref={visibleRef} className="h-full">
    <Card className={cn("h-full", borderClass)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            {icon}
            {CATEGORY_LABELS[category]}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500">Sem widgets visíveis.</p>
          {editMode && hidden.length > 0 ? (
            <button
              type="button"
              onClick={() => onLayoutChange(toggleWidgetVisibility(layout, hidden[0]!.id, true))}
              className="mt-2 text-xs text-blue-400 hover:underline"
            >
              Adicionar widget
            </button>
          ) : null}
        </CardContent>
      </Card>
    </div>
    );
  }

  return (
    <div ref={visibleRef} className="h-full">
    <Card className={cn("h-full overflow-hidden", borderClass)}>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            {icon}
            {CATEGORY_LABELS[category]}
            {!editMode && slides.length > 1 ? (
              <span className="text-[10px] font-normal text-slate-500">
                {carouselIndex + 1}/{slides.length}
              </span>
            ) : null}
          </CardTitle>
          <div className="flex items-center gap-2">
            {category === "empresarial" ? (
              <PeriodComparisonFilter value={periodo} onChange={setPeriodo} />
            ) : null}
            {editMode && hidden.length > 0 ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setAddOpen((o) => !o)}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-700/60 px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-800"
                >
                  <Plus className="h-3 w-3" /> Widget
                </button>
                {addOpen ? (
                  <div className="absolute right-0 top-full z-50 mt-1 max-h-48 min-w-[11rem] overflow-auto rounded-lg border border-slate-700/60 bg-slate-950 py-1 shadow-xl">
                    {hidden.map((w) => (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => {
                          onLayoutChange(toggleWidgetVisibility(layout, w.id, true));
                          setAddOpen(false);
                        }}
                        className="block w-full px-3 py-1.5 text-left text-[11px] text-slate-300 hover:bg-slate-800"
                      >
                        {getCatalogEntry(w.id)?.label ?? w.id}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
            <Link href={reportHref} className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300">
              Relatório <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </CardHeader>
      <CardContent className="overflow-hidden">
        <ContentCarousel
          ariaLabel={`Widgets ${CATEGORY_LABELS[category]}`}
          autoPlay={!editMode && slides.length > 1}
          fixedHeight={fixedHeight}
          onIndexChange={setCarouselIndex}
        >
          {slides.map((group, i) => (
            <WidgetSlideView
              key={`slide-${i}-${group.widgetIds.join("-")}`}
              group={group}
              sliderWidthCols={sliderWidthCols}
              editMode={editMode}
              dropTargetId={dropTargetId}
              dragActiveId={dragIdRef.current}
              renderWidget={renderWidget}
              onRemove={(id) => onLayoutChange(toggleWidgetVisibility(layout, id, false))}
              onDragStart={onDragStart}
            />
          ))}
        </ContentCarousel>
      </CardContent>
    </Card>
    </div>
  );
}
