"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { GripVertical, X } from "lucide-react";
import { cn } from "@/lib/ui/cn";
import { snapColSpan, type DashboardWidgetId } from "@/lib/dashboard/widget-layout";

type Props = {
  widgetId: DashboardWidgetId;
  title: string;
  colSpan: 4 | 6 | 8 | 12;
  minHeight: number | null;
  editMode: boolean;
  isDropTarget?: boolean;
  onResizeCommit: (colSpan: 4 | 6 | 8 | 12, minHeight: number | null) => void;
  onRemove: () => void;
  onReorderStart: (e: React.PointerEvent, id: DashboardWidgetId) => void;
  children: ReactNode;
};

function colSpanClass(colSpan: 4 | 6 | 8 | 12) {
  switch (colSpan) {
    case 4:
      return "col-span-1 lg:col-span-4";
    case 6:
      return "col-span-1 lg:col-span-6";
    case 8:
      return "col-span-1 lg:col-span-8";
    default:
      return "col-span-1 lg:col-span-12";
  }
}

export function DashboardWidgetShell({
  widgetId,
  title,
  colSpan,
  minHeight,
  editMode,
  isDropTarget,
  onResizeCommit,
  onRemove,
  onReorderStart,
  children,
}: Props) {
  const shellRef = useRef<HTMLDivElement>(null);
  const [resizing, setResizing] = useState(false);
  const [preview, setPreview] = useState<{ colSpan: 4 | 6 | 8 | 12; minHeight: number } | null>(
    null,
  );

  const displayColSpan = preview?.colSpan ?? colSpan;
  const displayMinHeight = preview?.minHeight ?? minHeight;

  const onResizePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!editMode) return;
      e.preventDefault();
      e.stopPropagation();

      const handle = e.currentTarget;
      handle.setPointerCapture(e.pointerId);

      const startX = e.clientX;
      const startY = e.clientY;
      const startSpan = colSpan;
      const startWidth = shellRef.current?.offsetWidth ?? 0;
      const startMinH = minHeight ?? shellRef.current?.offsetHeight ?? 280;
      const gridEl = shellRef.current?.parentElement;
      const gridWidth = gridEl?.clientWidth ?? startWidth;

      let latestSpan = startSpan;
      let latestMinH = startMinH;

      setResizing(true);

      function spanFromPixelWidth(width: number): 4 | 6 | 8 | 12 {
        const ratio = width / Math.max(gridWidth, 1);
        if (ratio <= 0.38) return 4;
        if (ratio <= 0.58) return 6;
        if (ratio <= 0.78) return 8;
        return 12;
      }

      function onMove(ev: PointerEvent) {
        if (!ev.isPrimary) return;
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        latestSpan = spanFromPixelWidth(Math.max(gridWidth * 0.3, startWidth + dx));
        latestMinH = Math.max(180, Math.round(startMinH + dy));
        setPreview({ colSpan: latestSpan, minHeight: latestMinH });
      }

      function onUp(ev: PointerEvent) {
        handle.releasePointerCapture(ev.pointerId);
        setResizing(false);
        setPreview(null);
        onResizeCommit(latestSpan, latestMinH);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
      }

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [editMode, colSpan, minHeight, onResizeCommit],
  );

  return (
    <div
      ref={shellRef}
      data-widget-id={widgetId}
      className={cn(
        colSpanClass(displayColSpan),
        "relative min-w-0 touch-none transition-[min-height] duration-300 ease-out",
        editMode && "rounded-xl ring-1 ring-violet-500/35 ring-offset-2 ring-offset-slate-950",
        isDropTarget && "ring-2 ring-violet-400/70",
        resizing && "select-none",
      )}
      style={{
        minHeight: displayMinHeight != null ? `${displayMinHeight}px` : undefined,
      }}
    >
      {editMode ? (
        <div
          className={cn(
            "relative z-30 mb-1 flex items-center justify-between rounded-t-lg border border-violet-500/25 bg-violet-950/40 px-2 py-1.5",
            isDropTarget && "border-violet-400/50 bg-violet-900/50",
          )}
        >
          <button
            type="button"
            aria-label={`Arrastar widget ${title}`}
            onPointerDown={(e) => onReorderStart(e, widgetId)}
            className="flex min-w-0 flex-1 cursor-grab items-center gap-1.5 text-left active:cursor-grabbing"
          >
            <GripVertical className="h-4 w-4 shrink-0 text-violet-400" />
            <span className="truncate text-[11px] font-medium text-violet-100">{title}</span>
            <span className="shrink-0 text-[10px] text-violet-400/70">{displayColSpan}/12</span>
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="ml-2 shrink-0 rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-red-400"
            aria-label={`Remover widget ${title}`}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}

      <div className={cn("relative", editMode && "pointer-events-none select-none opacity-90")}>
        {children}
      </div>

      {editMode ? (
        <div className="absolute inset-x-0 bottom-0 top-8 z-20 rounded-b-xl" aria-hidden />
      ) : null}

      {editMode ? (
        <>
          {/* Barra inferior - redimensionar altura */}
          <div
            role="separator"
            aria-label="Redimensionar altura"
            onPointerDown={onResizePointerDown}
            className="absolute bottom-0 left-2 right-10 z-30 h-3 cursor-ns-resize rounded-b-lg bg-gradient-to-t from-violet-500/25 to-transparent"
          />
          {/* Canto - redimensionar largura e altura */}
          <div
            role="separator"
            aria-label="Redimensionar widget"
            onPointerDown={onResizePointerDown}
            className="absolute bottom-0 right-0 z-40 flex h-8 w-8 cursor-se-resize items-end justify-end rounded-br-lg p-1.5 text-violet-300/90 hover:bg-violet-900/40"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden className="opacity-80">
              <path d="M12 4v8H4" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </div>
        </>
      ) : null}
    </div>
  );
}
