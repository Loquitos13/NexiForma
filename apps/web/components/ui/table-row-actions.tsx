"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal } from "lucide-react";
import { useCompactTable } from "@/lib/client/use-compact-table";
import { cn } from "@/lib/ui/cn";
import { Button } from "./button";

type Props = {
  children: ReactNode;
  label?: string;
};

const MENU_MIN_WIDTH = 176;
const VIEWPORT_PAD = 8;

export function TableRowActions({ children, label = "Acções" }: Props) {
  const compact = useCompactTable();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [panelStyle, setPanelStyle] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = useCallback(() => {
    const btn = btnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const vw = window.innerWidth;
    let left = rect.right - MENU_MIN_WIDTH;
    if (left < VIEWPORT_PAD) left = VIEWPORT_PAD;
    if (left + MENU_MIN_WIDTH > vw - VIEWPORT_PAD) {
      left = vw - MENU_MIN_WIDTH - VIEWPORT_PAD;
    }
    let top = rect.bottom + 6;
    if (top + 120 > window.innerHeight - VIEWPORT_PAD) {
      top = Math.max(VIEWPORT_PAD, rect.top - 126);
    }
    setPanelStyle({ top, left });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    function onDoc(ev: MouseEvent) {
      const target = ev.target as Node;
      if (btnRef.current?.contains(target)) return;
      if (document.getElementById(menuId)?.contains(target)) return;
      setOpen(false);
    }
    function onKey(ev: KeyboardEvent) {
      if (ev.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, menuId, updatePosition]);

  if (!compact) {
    return (
      <div className="flex flex-wrap items-center justify-end gap-1">{children}</div>
    );
  }

  const panel =
    open && panelStyle && mounted ? (
      <div
        id={menuId}
        role="menu"
        style={{ top: panelStyle.top, left: panelStyle.left, minWidth: MENU_MIN_WIDTH }}
        className={cn(
          "fixed z-[200] max-w-[min(calc(100vw-1rem),14rem)] rounded-lg border border-slate-600/60",
          "bg-slate-900 py-1 shadow-xl shadow-black/50 ring-1 ring-black/20",
          "table-row-actions-menu [&_a]:block [&_button]:w-full [&_button]:justify-start",
        )}
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="flex flex-col gap-0.5 px-1">{children}</div>
      </div>
    ) : null;

  return (
    <>
      <Button
        ref={btnRef}
        type="button"
        size="icon"
        variant="ghost"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        title={label}
        onClick={(ev) => {
          ev.stopPropagation();
          setOpen((v) => {
            const next = !v;
            if (next) updatePosition();
            return next;
          });
        }}
      >
        <MoreHorizontal className="h-4 w-4" />
        <span className="sr-only">{label}</span>
      </Button>
      {panel && mounted ? createPortal(panel, document.body) : null}
    </>
  );
}
