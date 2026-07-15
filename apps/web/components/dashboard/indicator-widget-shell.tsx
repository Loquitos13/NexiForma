"use client";

import { ChevronLeft, ChevronRight, GripVertical, X } from "lucide-react";
import { getCatalogEntry } from "@/lib/dashboard/widget-catalog";
import { cn } from "@/lib/ui/cn";

type Props = {
  widgetId: string;
  editMode: boolean;
  isDropTarget?: boolean;
  onRemove: () => void;
  onDragStart: (e: React.PointerEvent) => void;
  children: React.ReactNode;
};

/** Slide interno do slider - ocupa 100% da largura do bloco. */
export function IndicatorWidgetShell({
  widgetId,
  editMode,
  isDropTarget,
  onRemove,
  onDragStart,
  children,
}: Props) {
  const entry = getCatalogEntry(widgetId);
  const heightPx = entry?.heightPx ?? 280;
  const label = entry?.label ?? widgetId;

  return (
    <div data-indicator-widget={widgetId} className="w-full px-0.5">
      <div
        className={cn(
          "relative flex w-full flex-col overflow-hidden rounded-lg border border-slate-700/50 bg-slate-900/60",
          editMode && "ring-1 ring-violet-500/30",
          isDropTarget && "ring-2 ring-violet-400/60",
        )}
        style={{ height: heightPx }}
      >
        {editMode ? (
          <div className="flex shrink-0 items-center justify-between gap-1 border-b border-violet-500/20 bg-violet-950/30 px-2 py-1">
            <button
              type="button"
              className="flex min-w-0 flex-1 cursor-grab items-center gap-1 text-left active:cursor-grabbing"
              onPointerDown={onDragStart}
            >
              <GripVertical className="h-3.5 w-3.5 shrink-0 text-violet-400" />
              <span className="truncate text-[10px] font-medium text-violet-100">{label}</span>
            </button>
            <button
              type="button"
              onClick={onRemove}
              className="rounded p-0.5 text-slate-500 hover:text-red-400"
              aria-label="Remover widget"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <div className="shrink-0 border-b border-slate-800/80 px-3 py-1.5">
            <p className="truncate text-[11px] font-medium text-slate-400">{label}</p>
          </div>
        )}

        <div
          className={cn(
            "min-h-0 flex-1 overflow-hidden p-2",
            editMode && "pointer-events-none opacity-90",
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
