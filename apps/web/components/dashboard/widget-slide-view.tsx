"use client";

import { GripVertical, X } from "lucide-react";
import { getCatalogEntry } from "@/lib/dashboard/widget-catalog";
import type { WidgetWidthCols } from "@/lib/dashboard/widget-catalog";
import { gridColsClass, type WidgetSlideGroup } from "@/lib/dashboard/slide-grouping";
import { cn } from "@/lib/ui/cn";

type TileProps = {
  widgetId: string;
  editMode: boolean;
  isDropTarget?: boolean;
  onRemove: () => void;
  onDragStart: (e: React.PointerEvent) => void;
  children: React.ReactNode;
};

function WidgetTile({ widgetId, editMode, isDropTarget, onRemove, onDragStart, children }: TileProps) {
  const label = getCatalogEntry(widgetId)?.label ?? widgetId;

  return (
    <div
      data-indicator-widget={widgetId}
      className={cn(
        "flex h-[132px] flex-col overflow-hidden rounded-lg border border-slate-700/50 bg-slate-900/60",
        editMode && "ring-1 ring-violet-500/30",
        isDropTarget && "ring-2 ring-violet-400/60",
      )}
    >
      {editMode ? (
        <div className="flex shrink-0 items-center justify-between gap-1 border-b border-violet-500/20 bg-violet-950/30 px-1.5 py-0.5">
          <button
            type="button"
            className="flex min-w-0 flex-1 cursor-grab items-center gap-0.5 text-left active:cursor-grabbing"
            onPointerDown={onDragStart}
          >
            <GripVertical className="h-3 w-3 shrink-0 text-violet-400" />
            <span className="truncate text-[9px] font-medium text-violet-100">{label}</span>
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="rounded p-0.5 text-slate-500 hover:text-red-400"
            aria-label="Remover"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <div className="shrink-0 border-b border-slate-800/80 px-2 py-1">
          <p className="truncate text-[10px] font-medium text-slate-400">{label}</p>
        </div>
      )}
      <div className={cn("min-h-0 flex-1 overflow-hidden p-1.5", editMode && "pointer-events-none opacity-90")}>
        {children}
      </div>
    </div>
  );
}

function WidgetFull({ widgetId, editMode, isDropTarget, onRemove, onDragStart, children }: TileProps) {
  const entry = getCatalogEntry(widgetId);
  const heightPx = entry?.heightPx ?? 280;
  const label = entry?.label ?? widgetId;

  return (
    <div data-indicator-widget={widgetId} className="w-full">
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
        <div className={cn("min-h-0 flex-1 overflow-hidden p-2", editMode && "pointer-events-none opacity-90")}>
          {children}
        </div>
      </div>
    </div>
  );
}

type SlideViewProps = {
  group: WidgetSlideGroup;
  sliderWidthCols: WidgetWidthCols;
  editMode: boolean;
  dropTargetId: string | null;
  dragActiveId: string | null;
  renderWidget: (widgetId: string) => React.ReactNode;
  onRemove: (widgetId: string) => void;
  onDragStart: (e: React.PointerEvent, widgetId: string) => void;
};

export function WidgetSlideView({
  group,
  sliderWidthCols,
  editMode,
  dropTargetId,
  dragActiveId,
  renderWidget,
  onRemove,
  onDragStart,
}: SlideViewProps) {
  if (group.layout === "grid") {
    return (
      <div className={cn("grid w-full gap-2", gridColsClass(sliderWidthCols))}>
        {group.widgetIds.map((id) => (
          <WidgetTile
            key={id}
            widgetId={id}
            editMode={editMode}
            isDropTarget={dropTargetId === id && dragActiveId !== id}
            onRemove={() => onRemove(id)}
            onDragStart={(e) => onDragStart(e, id)}
          >
            {renderWidget(id)}
          </WidgetTile>
        ))}
      </div>
    );
  }

  const id = group.widgetIds[0]!;
  return (
    <WidgetFull
      widgetId={id}
      editMode={editMode}
      isDropTarget={dropTargetId === id && dragActiveId !== id}
      onRemove={() => onRemove(id)}
      onDragStart={(e) => onDragStart(e, id)}
    >
      {renderWidget(id)}
    </WidgetFull>
  );
}
