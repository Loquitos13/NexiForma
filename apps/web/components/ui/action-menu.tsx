"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/ui/cn";
import { Button } from "./button";

export type ActionMenuItem = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  icon?: React.ReactNode;
};

type ActionMenuProps = {
  items: ActionMenuItem[];
  /** Preferência de abertura; ajusta automaticamente se não couber no viewport. */
  side?: "right" | "left";
  label?: string;
  iconOnly?: boolean;
};

const MENU_WIDTH = 208;
const MENU_ITEM_HEIGHT = 44;
const GAP = 8;
const VIEWPORT_PAD = 8;

export function ActionMenu({
  items,
  side = "left",
  label = "Acções",
  iconOnly = false,
}: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [panelStyle, setPanelStyle] = useState<{ top: number; left: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = useCallback(() => {
    const btn = btnRef.current;
    if (!btn) return;

    const rect = btn.getBoundingClientRect();
    const menuHeight = items.length * MENU_ITEM_HEIGHT + 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let left =
      side === "right"
        ? rect.right + GAP
        : rect.left - MENU_WIDTH - GAP;

    if (left + MENU_WIDTH > vw - VIEWPORT_PAD) {
      left = rect.left - MENU_WIDTH - GAP;
    }
    if (left < VIEWPORT_PAD) {
      left = rect.right + GAP;
    }
    if (left + MENU_WIDTH > vw - VIEWPORT_PAD) {
      left = Math.max(VIEWPORT_PAD, vw - MENU_WIDTH - VIEWPORT_PAD);
    }

    let top = rect.top;
    if (top + menuHeight > vh - VIEWPORT_PAD) {
      top = Math.max(VIEWPORT_PAD, vh - menuHeight - VIEWPORT_PAD);
    }
    if (top < VIEWPORT_PAD) {
      top = VIEWPORT_PAD;
    }

    setPanelStyle({ top, left });
  }, [items.length, side]);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    function onDoc(ev: MouseEvent) {
      const target = ev.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (document.getElementById(menuId)?.contains(target)) return;
      setOpen(false);
    }
    function onKey(ev: KeyboardEvent) {
      if (ev.key === "Escape") setOpen(false);
    }
    function onReflow() {
      updatePosition();
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onReflow);
    window.addEventListener("scroll", onReflow, true);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onReflow);
      window.removeEventListener("scroll", onReflow, true);
    };
  }, [open, menuId, updatePosition]);

  const panel =
    open && panelStyle && mounted ? (
      <div
        id={menuId}
        role="menu"
        style={{ top: panelStyle.top, left: panelStyle.left, width: MENU_WIDTH }}
        className={cn(
          "fixed z-[200] rounded-lg border border-slate-600/60 bg-slate-900 py-1",
          "shadow-xl shadow-black/50 ring-1 ring-black/20",
        )}
        onClick={(ev) => ev.stopPropagation()}
      >
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            role="menuitem"
            disabled={item.disabled}
            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-slate-200 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap"
            onClick={(ev) => {
              ev.stopPropagation();
              setOpen(false);
              item.onClick();
            }}
          >
            {item.icon}
            <span className="truncate">{item.label}</span>
          </button>
        ))}
      </div>
    ) : null;

  return (
    <div ref={rootRef} className="relative inline-flex justify-end">
      <Button
        ref={btnRef}
        type="button"
        size={iconOnly ? "icon" : "sm"}
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
        {iconOnly ? <span className="sr-only">{label}</span> : label}
      </Button>
      {panel && mounted ? createPortal(panel, document.body) : null}
    </div>
  );
}
