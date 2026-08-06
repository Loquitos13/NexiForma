"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, BellCheck } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { cn } from "@/lib/ui/cn";

type Notif = {
  id: string;
  titulo: string;
  mensagem: string;
  link: string | null;
  lida: boolean;
  createdAt: string;
  tipo: string;
  user?: { displayName: string | null; email: string };
};

type PanelPos = { top: number; right: number };

function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "Agora";
  if (mins < 60) return `Há ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Há ${hours} h`;
  return date.toLocaleDateString("pt-PT", { day: "2-digit", month: "short" });
}

export function PortalNotificationsBell() {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const markingRef = useRef<Set<string>>(new Set());
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(false);
  const [panelPos, setPanelPos] = useState<PanelPos | null>(null);

  useEffect(() => setMounted(true), []);

  const refreshCount = useCallback(async () => {
    const cRes = await bffFetch("/api/v1/notificacoes/portal/nao-lidas", {
      headers: { accept: "application/json" },
    });
    if (cRes.ok) {
      const c = (await cRes.json()) as { count?: number };
      setCount(c.count ?? 0);
    }
  }, []);

  const refresh = useCallback(async () => {
    const [cRes, lRes] = await Promise.all([
      bffFetch("/api/v1/notificacoes/portal/nao-lidas", { headers: { accept: "application/json" } }),
      bffFetch("/api/v1/notificacoes/portal", { headers: { accept: "application/json" } }),
    ]);
    if (cRes.ok) {
      const c = (await cRes.json()) as { count?: number };
      setCount(c.count ?? 0);
    }
    if (lRes.ok) {
      setItems((await lRes.json()) as Notif[]);
    }
  }, []);

  const updatePanelPos = useCallback(() => {
    const btn = buttonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const panelWidth = Math.min(320, window.innerWidth - 24);
    const gap = 8;
    let right = window.innerWidth - rect.left + gap;
    const leftEdge = window.innerWidth - right - panelWidth;
    if (leftEdge < 12) {
      right = window.innerWidth - panelWidth - 12;
    }
    setPanelPos({ top: rect.top, right });
  }, []);

  useEffect(() => {
    void refreshCount();
  }, [refreshCount]);

  useEffect(() => {
    if (!mounted) return;

    const onRefresh = () => {
      void (open ? refresh() : refreshCount());
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") onRefresh();
    };

    const onSwMessage = (event: MessageEvent) => {
      if (
        event.data &&
        typeof event.data === "object" &&
        (event.data as { type?: string }).type === "NEXIFORMA_NOTIFICATIONS_REFRESH"
      ) {
        onRefresh();
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    navigator.serviceWorker?.addEventListener("message", onSwMessage);

    const intervalMs = document.visibilityState === "visible" ? 20_000 : 60_000;
    const t = setInterval(onRefresh, intervalMs);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      navigator.serviceWorker?.removeEventListener("message", onSwMessage);
      clearInterval(t);
    };
  }, [mounted, open, refresh, refreshCount]);

  useEffect(() => {
    if (!mounted) return;
    updatePanelPos();
  }, [mounted, updatePanelPos]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePanelPos();
    window.addEventListener("resize", updatePanelPos);
    window.addEventListener("scroll", updatePanelPos, true);
    return () => {
      window.removeEventListener("resize", updatePanelPos);
      window.removeEventListener("scroll", updatePanelPos, true);
    };
  }, [open, updatePanelPos]);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function togglePanel() {
    if (!open) {
      updatePanelPos();
      setOpen(true);
      setLoading(true);
      await refresh();
      setLoading(false);
      return;
    }
    setOpen(false);
  }

  async function markRead(id: string) {
    if (markingRef.current.has(id)) return;
    markingRef.current.add(id);
    try {
      // Optimistic: remove unread dot immediately.
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, lida: true } : n)));
      setCount((c) => Math.max(0, c - 1));
      await bffFetch(`/api/v1/notificacoes/portal/${id}/lida`, {
        method: "PATCH",
        headers: { accept: "application/json" },
      });
      await refresh();
    } finally {
      markingRef.current.delete(id);
    }
  }

  function openNotification(n: Notif) {
    if (!n.lida) void markRead(n.id);
    setOpen(false);
    if (n.link) router.push(n.link);
    else router.push("/portal/notificacoes");
  }

  const panel =
    mounted && panelPos ? (
      <div
        ref={panelRef}
        role="dialog"
        aria-label="Notificações"
        aria-hidden={!open}
        style={{ top: panelPos.top, right: panelPos.right }}
        className={cn(
          "fixed z-[300] w-[min(20rem,calc(100vw-1.5rem))]",
          "origin-right transition-[opacity,transform] duration-200 ease-out will-change-transform",
          open
            ? "pointer-events-auto translate-x-0 scale-100 opacity-100"
            : "pointer-events-none translate-x-3 scale-[0.97] opacity-0",
        )}
      >
        <div className="overflow-hidden rounded-xl border border-slate-600/70 bg-slate-950 shadow-2xl shadow-black/50 ring-1 ring-slate-700/40">
          <div className="flex items-center justify-between border-b border-slate-700/60 bg-slate-900/90 px-4 py-3">
            <h2 className="text-sm font-semibold tracking-tight text-slate-100">Notificações</h2>
            {count > 0 ? (
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                {count} por ler
              </span>
            ) : null}
          </div>

          <div className="max-h-[min(18rem,50vh)] overflow-y-auto overscroll-contain">
            {loading ? (
              <p className="px-4 py-6 text-center text-xs text-slate-500">A carregar…</p>
            ) : items.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-slate-500">Sem notificações.</p>
            ) : (
              <ul className="divide-y divide-slate-800/80">
                {items.map((n) => (
                  <li
                    key={n.id}
                    className={cn(
                      "group relative transition-all duration-150",
                      "hover:bg-violet-600/25 hover:ring-1 hover:ring-inset hover:ring-violet-500/35",
                      "has-[:active]:scale-[0.985] has-[:active]:bg-violet-600/40",
                      !n.lida ? "bg-slate-900/40" : "bg-transparent",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => openNotification(n)}
                      className="w-full px-4 py-3 text-left"
                    >
                      <div className="flex items-start gap-2">
                        {!n.lida ? (
                          <span
                            className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-amber-400 transition-transform group-hover:scale-110"
                            aria-hidden
                          />
                        ) : (
                          <span className="mt-1.5 h-2 w-2 shrink-0" aria-hidden />
                        )}
                        <div className="min-w-0 flex-1 pr-8">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium leading-snug text-slate-100 group-hover:text-white">
                              {n.titulo}
                            </p>
                            <time
                              className="shrink-0 text-[10px] text-slate-500"
                              dateTime={n.createdAt}
                            >
                              {formatRelativeTime(n.createdAt)}
                            </time>
                          </div>
                          <p className="mt-1 text-xs leading-relaxed text-slate-400 line-clamp-2 group-hover:text-slate-300">
                            {n.mensagem}
                          </p>
                          {n.user?.displayName || n.user?.email ? (
                            <p className="mt-1 text-[10px] text-slate-500">
                              {n.user.displayName ?? n.user.email}
                            </p>
                          ) : null}
                          {n.link ? (
                            <p className="mt-2 text-[11px] text-slate-500 group-hover:text-slate-400">
                              Clica para abrir
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </button>
                    {!n.lida ? (
                      <button
                        type="button"
                        title="Marcar como lida"
                        aria-label="Marcar como lida"
                        onClick={(e) => {
                          e.stopPropagation();
                          void markRead(n.id);
                        }}
                        className={cn(
                          "absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-md",
                          "border border-emerald-500/50 bg-emerald-950/60 text-emerald-400",
                          "opacity-0 transition-all duration-150",
                          "group-hover:opacity-100 group-focus-within:opacity-100",
                          "hover:border-emerald-400 hover:bg-emerald-500/25 hover:text-emerald-300 hover:scale-105",
                          "active:scale-95 active:bg-emerald-500/35",
                        )}
                      >
                        <BellCheck className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t border-slate-800/80 bg-slate-900/50 px-4 py-2.5">
            <Link
              href="/portal/notificacoes"
              className="block text-center text-xs font-medium text-slate-400 hover:text-slate-200"
              onClick={() => setOpen(false)}
            >
              Ver todas
            </Link>
          </div>
        </div>
      </div>
    ) : null;

  return (
    <div ref={rootRef} className="relative flex items-center">
      {mounted && panelPos ? createPortal(panel, document.body) : null}

      <button
        ref={buttonRef}
        type="button"
        onClick={() => void togglePanel()}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={cn(
          "relative rounded-lg p-2 transition-all duration-200",
          open
            ? "bg-slate-800 text-amber-200 ring-2 ring-amber-400/40 shadow-[0_0_16px_rgba(251,191,36,0.25)]"
            : count > 0
              ? "portal-bell-glow text-amber-300 hover:bg-slate-800/60 hover:text-amber-200"
              : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200",
        )}
        title={count > 0 ? `${count} notificação(ões) por ler` : "Notificações"}
        aria-label={count > 0 ? `Notificações, ${count} por ler` : "Notificações"}
      >
        <Bell
          className={cn(
            "h-4 w-4",
            (count > 0 || open) && "drop-shadow-[0_0_6px_rgba(251,191,36,0.85)]",
          )}
        />
        {count > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white ring-2 ring-slate-950">
            {count > 9 ? "9+" : count}
          </span>
        ) : null}
      </button>
    </div>
  );
}
