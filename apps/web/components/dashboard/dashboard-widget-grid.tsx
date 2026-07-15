"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { LayoutGrid, Plus, RotateCcw, Settings2 } from "lucide-react";
import {
  DEFAULT_WIDGET_LAYOUT,
  loadWidgetLayout,
  mergeMissingWidgets,
  saveWidgetLayout,
  WIDGET_LABELS,
  type DashboardWidgetId,
  type DashboardWidgetLayout,
  type DashboardWidgetLayoutItem,
} from "@/lib/dashboard/widget-layout";
import { DashboardWidgetShell } from "@/components/dashboard/dashboard-widget-shell";
import { cn } from "@/lib/ui/cn";

type WidgetRenderProps = {
  compact: boolean;
  editMode: boolean;
};

type Props = {
  storageKey: string;
  renderWidget: (id: DashboardWidgetId, props: WidgetRenderProps) => ReactNode;
};

function reorderLayout(
  layout: DashboardWidgetLayout,
  activeId: DashboardWidgetId,
  overId: DashboardWidgetId,
): DashboardWidgetLayout {
  if (activeId === overId) return layout;
  const visible = layout.filter((w) => w.visible).sort((a, b) => a.order - b.order);
  const from = visible.findIndex((w) => w.id === activeId);
  const to = visible.findIndex((w) => w.id === overId);
  if (from < 0 || to < 0) return layout;

  const next = [...visible];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);

  const orderById = new Map(next.map((w, i) => [w.id, i]));
  return layout.map((w) => ({
    ...w,
    order: orderById.get(w.id) ?? w.order,
  }));
}

export function DashboardWidgetGrid({ storageKey, renderWidget }: Props) {
  const [layout, setLayout] = useState<DashboardWidgetLayout>(DEFAULT_WIDGET_LAYOUT);
  const [editMode, setEditMode] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [dropTargetId, setDropTargetId] = useState<DashboardWidgetId | null>(null);
  const dragIdRef = useRef<DashboardWidgetId | null>(null);

  useEffect(() => {
    setLayout(mergeMissingWidgets(loadWidgetLayout(storageKey)));
    setHydrated(true);
  }, [storageKey]);

  const persist = useCallback(
    (next: DashboardWidgetLayout) => {
      setLayout(next);
      saveWidgetLayout(storageKey, next);
    },
    [storageKey],
  );

  const visibleWidgets = useMemo(
    () => [...layout].filter((w) => w.visible).sort((a, b) => a.order - b.order),
    [layout],
  );

  const hiddenWidgets = layout.filter((w) => !w.visible);

  const updateWidget = useCallback(
    (id: DashboardWidgetId, patch: Partial<DashboardWidgetLayoutItem>) => {
      persist(layout.map((w) => (w.id === id ? { ...w, ...patch } : w)));
    },
    [layout, persist],
  );

  const removeWidget = useCallback(
    (id: DashboardWidgetId) => updateWidget(id, { visible: false }),
    [updateWidget],
  );

  const addWidget = useCallback(
    (id: DashboardWidgetId) => {
      updateWidget(id, { visible: true, order: layout.length });
      setAddOpen(false);
    },
    [layout.length, updateWidget],
  );

  const resetLayout = useCallback(() => persist(DEFAULT_WIDGET_LAYOUT), [persist]);

  const onResizeCommit = useCallback(
    (id: DashboardWidgetId, colSpan: 4 | 6 | 8 | 12, minHeight: number | null) => {
      persist(
        layout.map((w) =>
          w.id === id ? { ...w, colSpan, minHeight: minHeight != null ? Math.max(180, minHeight) : null } : w,
        ),
      );
    },
    [layout, persist],
  );

  const onReorderStart = useCallback(
    (e: React.PointerEvent, id: DashboardWidgetId) => {
      if (!editMode) return;
      e.preventDefault();
      e.stopPropagation();

      const handle = e.currentTarget;
      handle.setPointerCapture(e.pointerId);
      dragIdRef.current = id;
      document.body.style.cursor = "grabbing";

      function targetFromPoint(x: number, y: number): DashboardWidgetId | null {
        const el = document.elementFromPoint(x, y)?.closest("[data-widget-id]");
        const raw = el?.getAttribute("data-widget-id");
        if (raw === "financeiro" || raw === "comercial" || raw === "empresarial") return raw;
        return null;
      }

      function onMove(ev: PointerEvent) {
        if (!ev.isPrimary) return;
        setDropTargetId(targetFromPoint(ev.clientX, ev.clientY));
      }

      function onUp(ev: PointerEvent) {
        handle.releasePointerCapture(ev.pointerId);
        document.body.style.cursor = "";
        const active = dragIdRef.current;
        const over = targetFromPoint(ev.clientX, ev.clientY);
        dragIdRef.current = null;
        setDropTargetId(null);
        if (active && over && active !== over) {
          persist(reorderLayout(layout, active, over));
        }
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
      }

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [editMode, layout, persist],
  );

  if (!hydrated) {
    return <p className="text-sm text-slate-500">A preparar dashboard…</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {editMode && hiddenWidgets.length > 0 ? (
          <div className="relative">
            <button
              type="button"
              onClick={() => setAddOpen((o) => !o)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700/60 bg-slate-900/80 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
            >
              <Plus className="h-3.5 w-3.5" />
              Adicionar widget
            </button>
            {addOpen ? (
              <div className="absolute right-0 top-full z-50 mt-1 min-w-[10rem] rounded-lg border border-slate-700/60 bg-slate-950 py-1 shadow-xl">
                {hiddenWidgets.map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => addWidget(w.id)}
                    className="block w-full px-3 py-2 text-left text-xs text-slate-300 hover:bg-slate-800"
                  >
                    {WIDGET_LABELS[w.id]}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
        {editMode ? (
          <button
            type="button"
            onClick={resetLayout}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700/60 px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-800"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Repor
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => {
            setEditMode((e) => !e);
            setAddOpen(false);
            setDropTargetId(null);
          }}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
            editMode
              ? "border-violet-500/50 bg-violet-900/30 text-violet-200"
              : "border-slate-700/60 bg-slate-900/80 text-slate-300 hover:bg-slate-800",
          )}
        >
          {editMode ? (
            <>
              <LayoutGrid className="h-3.5 w-3.5" />
              Concluir
            </>
          ) : (
            <>
              <Settings2 className="h-3.5 w-3.5" />
              Personalizar
            </>
          )}
        </button>
      </div>

      {editMode ? (
        <p className="text-xs text-slate-500">
          <strong className="font-medium text-slate-400">Arrastar</strong> pela barra superior para
          reordenar. <strong className="font-medium text-slate-400">Redimensionar</strong> pelo canto
          inferior direito ou pela barra inferior.
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {visibleWidgets.map((w) => (
          <DashboardWidgetShell
            key={w.id}
            widgetId={w.id}
            title={WIDGET_LABELS[w.id]}
            colSpan={w.colSpan}
            minHeight={w.minHeight}
            editMode={editMode}
            isDropTarget={dropTargetId === w.id && dragIdRef.current !== w.id}
            onResizeCommit={(colSpan, minHeight) => onResizeCommit(w.id, colSpan, minHeight)}
            onRemove={() => removeWidget(w.id)}
            onReorderStart={onReorderStart}
          >
            {renderWidget(w.id, { compact: w.colSpan <= 6, editMode })}
          </DashboardWidgetShell>
        ))}
      </div>
    </div>
  );
}
