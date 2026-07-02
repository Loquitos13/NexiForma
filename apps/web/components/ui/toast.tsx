"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/ui/cn";

export type ToastVariant = "success" | "error";

export type ToastItem = {
  id: string;
  variant: ToastVariant;
  message: string;
  durationMs: number;
  createdAt: number;
};

type ToastContextValue = {
  success: (message: string, durationMs?: number) => void;
  error: (message: string, durationMs?: number) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION = 5000;

let externalPush: ((variant: ToastVariant, message: string, durationMs?: number) => void) | null =
  null;

/** API imperativa - útil fora de componentes React. */
export function pushToast(variant: ToastVariant, message: string, durationMs = DEFAULT_DURATION) {
  externalPush?.(variant, message, durationMs);
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      success: (m, d) => pushToast("success", m, d),
      error: (m, d) => pushToast("error", m, d),
    };
  }
  return ctx;
}

function ToastCard({ item, onDone }: { item: ToastItem; onDone: (id: string) => void }) {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const start = item.createdAt;
    const end = start + item.durationMs;
    const tick = () => {
      const now = Date.now();
      const pct = Math.max(0, ((end - now) / item.durationMs) * 100);
      setProgress(pct);
      if (now >= end) onDone(item.id);
    };
    tick();
    const id = window.setInterval(tick, 50);
    return () => window.clearInterval(id);
  }, [item, onDone]);

  const isSuccess = item.variant === "success";

  return (
    <div
      role="status"
      className={cn(
        "pointer-events-auto w-[min(100vw-2rem,22rem)] overflow-hidden rounded-lg border shadow-xl backdrop-blur-sm",
        isSuccess
          ? "border-emerald-500/40 bg-emerald-950/95 text-emerald-50"
          : "border-red-500/40 bg-red-950/95 text-red-50",
      )}
    >
      <div className="px-4 py-3 text-sm leading-snug">{item.message}</div>
      <div className="h-1 w-full bg-black/20">
        <div
          className={cn("h-full transition-[width] duration-75 ease-linear", isSuccess ? "bg-emerald-400" : "bg-red-400")}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((variant: ToastVariant, message: string, durationMs = DEFAULT_DURATION) => {
    const trimmed = message.trim();
    if (!trimmed) return;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setItems((prev) => [...prev.slice(-4), { id, variant, message: trimmed, durationMs, createdAt: Date.now() }]);
  }, []);

  useEffect(() => {
    externalPush = push;
    return () => {
      externalPush = null;
    };
  }, [push]);

  const value = useMemo<ToastContextValue>(
    () => ({
      success: (m, d) => push("success", m, d),
      error: (m, d) => push("error", m, d),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed top-4 right-4 z-[9999] flex flex-col gap-2"
      >
        {items.map((item) => (
          <ToastCard key={item.id} item={item} onDone={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
