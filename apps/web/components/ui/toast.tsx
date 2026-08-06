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
import { X } from "lucide-react";
import { cn } from "@/lib/ui/cn";

export type ToastVariant = "success" | "error" | "warning" | "info";

export type ToastAction = {
  label: string;
  onClick: () => void | Promise<void>;
  variant?: "primary" | "ghost";
};

export type ToastItem = {
  id: string;
  variant: ToastVariant;
  title?: string;
  message: string;
  /** `0` = sticky (sem timer / barra de progresso). */
  durationMs: number;
  createdAt: number;
  actions?: ToastAction[];
};

type ToastPushOptions = {
  id?: string;
  title?: string;
  durationMs?: number;
  actions?: ToastAction[];
};

type ToastContextValue = {
  success: (message: string, durationMs?: number) => void;
  error: (message: string, durationMs?: number) => void;
  warning: (message: string, opts?: ToastPushOptions) => void;
  info: (message: string, opts?: ToastPushOptions) => void;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION = 5000;

type ExternalPush = (variant: ToastVariant, message: string, opts?: ToastPushOptions) => void;

let externalPush: ExternalPush | null = null;
let externalDismiss: ((id: string) => void) | null = null;

/** API imperativa - útil fora de componentes React. */
export function pushToast(
  variant: ToastVariant,
  message: string,
  durationMsOrOpts: number | ToastPushOptions = DEFAULT_DURATION,
) {
  const opts: ToastPushOptions =
    typeof durationMsOrOpts === "number"
      ? { durationMs: durationMsOrOpts }
      : durationMsOrOpts;
  externalPush?.(variant, message, opts);
}

export function dismissToast(id: string) {
  externalDismiss?.(id);
}

/**
 * Toast sticky (sem timer) no canto das notificações in-app.
 * Reutiliza o mesmo `id` para substituir em vez de empilhar.
 */
export function pushStickyToast(
  variant: Exclude<ToastVariant, "success" | "error">,
  message: string,
  opts: Omit<ToastPushOptions, "durationMs"> & { title?: string },
) {
  pushToast(variant, message, { ...opts, durationMs: 0 });
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      success: (m, d) => pushToast("success", m, d ?? DEFAULT_DURATION),
      error: (m, d) => pushToast("error", m, d ?? DEFAULT_DURATION),
      warning: (m, opts) => pushToast("warning", m, opts),
      info: (m, opts) => pushToast("info", m, opts),
      dismiss: (id) => dismissToast(id),
    };
  }
  return ctx;
}

const VARIANT_STYLES: Record<ToastVariant, string> = {
  success: "border-emerald-500/40 bg-emerald-950/95 text-emerald-50",
  error: "border-red-500/40 bg-red-950/95 text-red-50",
  warning: "border-amber-500/40 bg-amber-950/95 text-amber-50",
  info: "border-sky-500/40 bg-slate-900/95 text-slate-50",
};

const PROGRESS_STYLES: Record<ToastVariant, string> = {
  success: "bg-emerald-400",
  error: "bg-red-400",
  warning: "bg-amber-400",
  info: "bg-sky-400",
};

function ToastCard({ item, onDone }: { item: ToastItem; onDone: (id: string) => void }) {
  const sticky = item.durationMs <= 0;
  const [progress, setProgress] = useState(100);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  useEffect(() => {
    if (sticky) return;
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
  }, [item, onDone, sticky]);

  return (
    <div
      role="status"
      className={cn(
        "pointer-events-auto w-[min(100vw-2rem,22rem)] overflow-hidden rounded-lg border shadow-xl backdrop-blur-sm",
        VARIANT_STYLES[item.variant],
      )}
    >
      <div className="flex items-start gap-2 px-4 py-3">
        <div className="min-w-0 flex-1 space-y-2">
          {item.title ? (
            <p className="text-sm font-semibold leading-snug">{item.title}</p>
          ) : null}
          <p className="text-sm leading-snug opacity-95">{item.message}</p>
          {item.actions?.length ? (
            <div className="flex flex-wrap gap-2 pt-0.5">
              {item.actions.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  disabled={busyAction !== null}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50",
                    action.variant === "ghost"
                      ? "bg-transparent hover:bg-white/10"
                      : "bg-white/15 hover:bg-white/25",
                  )}
                  onClick={() => {
                    void (async () => {
                      setBusyAction(action.label);
                      try {
                        await action.onClick();
                      } finally {
                        setBusyAction(null);
                      }
                    })();
                  }}
                >
                  {busyAction === action.label ? "…" : action.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        {sticky ? (
          <button
            type="button"
            className="shrink-0 rounded-md p-0.5 opacity-70 hover:opacity-100"
            aria-label="Fechar"
            onClick={() => onDone(item.id)}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
      {!sticky ? (
        <div className="h-1 w-full bg-black/20">
          <div
            className={cn(
              "h-full transition-[width] duration-75 ease-linear",
              PROGRESS_STYLES[item.variant],
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((variant: ToastVariant, message: string, opts?: ToastPushOptions) => {
    const trimmed = message.trim();
    if (!trimmed) return;
    const id = opts?.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const durationMs = opts?.durationMs ?? DEFAULT_DURATION;
    const next: ToastItem = {
      id,
      variant,
      title: opts?.title,
      message: trimmed,
      durationMs,
      createdAt: Date.now(),
      actions: opts?.actions,
    };
    setItems((prev) => {
      const without = prev.filter((t) => t.id !== id);
      return [...without.slice(-4), next];
    });
  }, []);

  useEffect(() => {
    externalPush = push;
    externalDismiss = dismiss;
    return () => {
      externalPush = null;
      externalDismiss = null;
    };
  }, [push, dismiss]);

  const value = useMemo<ToastContextValue>(
    () => ({
      success: (m, d) => push("success", m, { durationMs: d ?? DEFAULT_DURATION }),
      error: (m, d) => push("error", m, { durationMs: d ?? DEFAULT_DURATION }),
      warning: (m, opts) => push("warning", m, opts),
      info: (m, opts) => push("info", m, opts),
      dismiss,
    }),
    [push, dismiss],
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
