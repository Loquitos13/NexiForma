"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { nextWidthCols, type WidgetWidthCols } from "@/lib/dashboard/widget-catalog";
import { widgetWidthPercent } from "@/lib/dashboard/chart-axis";
import { cn } from "@/lib/ui/cn";

type Props = {
  blockId: string;
  label: string;
  widthCols: WidgetWidthCols;
  editMode: boolean;
  onWidthChange: (cols: WidgetWidthCols) => void;
  children: React.ReactNode;
  className?: string;
};

/** Bloco redimensionável da dashboard (slider ou painel). */
export function DashboardBlockShell({
  blockId,
  label,
  widthCols,
  editMode,
  onWidthChange,
  children,
  className,
}: Props) {
  return (
    <div
      data-dashboard-block={blockId}
      className={cn(
        "dashboard-block-shell w-full min-w-0 max-w-full shrink-0 transition-[width] duration-200 sm:max-w-none",
        className,
      )}
      style={{
        width: widgetWidthPercent(widthCols),
        minWidth: widthCols <= 4 ? 200 : 280,
      }}
    >
      {editMode ? (
        <div className="mb-1 flex items-center justify-between gap-2 rounded-md border border-violet-500/25 bg-violet-950/20 px-2 py-1">
          <span className="truncate text-[10px] font-medium text-violet-200">{label}</span>
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              disabled={widthCols <= 4}
              onClick={() => onWidthChange(nextWidthCols(widthCols, -1))}
              className="rounded p-0.5 text-slate-400 hover:bg-slate-800 disabled:opacity-30"
              aria-label="Reduzir largura do bloco"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="w-8 text-center text-[9px] tabular-nums text-violet-300/80">{widthCols}/12</span>
            <button
              type="button"
              disabled={widthCols >= 12}
              onClick={() => onWidthChange(nextWidthCols(widthCols, 1))}
              className="rounded p-0.5 text-slate-400 hover:bg-slate-800 disabled:opacity-30"
              aria-label="Aumentar largura do bloco"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : null}
      {children}
    </div>
  );
}
