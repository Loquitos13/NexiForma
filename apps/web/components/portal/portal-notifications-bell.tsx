"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";

type Notif = {
  id: string;
  titulo: string;
  mensagem: string;
  link: string | null;
  lida: boolean;
  createdAt: string;
  tipo: string;
};

export function PortalNotificationsBell() {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(false);

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

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 60_000);
    return () => clearInterval(t);
  }, [refresh]);

  async function openPanel() {
    setOpen((v) => !v);
    if (!open) {
      setLoading(true);
      await refresh();
      setLoading(false);
    }
  }

  async function markRead(id: string) {
    await bffFetch(`/api/v1/notificacoes/portal/${id}/lida`, {
      method: "PATCH",
      headers: { accept: "application/json" },
    });
    await refresh();
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => void openPanel()}
        className="relative rounded-md p-1.5 text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
        title="Notificações"
      >
        <Bell className="h-4 w-4" />
        {count > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
            {count > 9 ? "9+" : count}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-slate-700/60 bg-slate-900 shadow-xl">
          <div className="border-b border-slate-700/50 px-3 py-2 text-xs font-semibold text-slate-300">
            Notificações
          </div>
          <div className="max-h-72 overflow-y-auto">
            {loading ? (
              <p className="px-3 py-4 text-xs text-slate-500">A carregar…</p>
            ) : items.length === 0 ? (
              <p className="px-3 py-4 text-xs text-slate-500">Sem notificações.</p>
            ) : (
              items.map((n) => (
                <div
                  key={n.id}
                  className={`border-b border-slate-800/80 px-3 py-2.5 text-xs ${n.lida ? "opacity-70" : ""}`}
                >
                  <p className="font-medium text-slate-200">{n.titulo}</p>
                  <p className="mt-0.5 text-slate-400 line-clamp-2">{n.mensagem}</p>
                  <div className="mt-1.5 flex gap-2">
                    {n.link ? (
                      <Link
                        href={n.link}
                        className="text-blue-400 hover:underline"
                        onClick={() => {
                          void markRead(n.id);
                          setOpen(false);
                        }}
                      >
                        Abrir
                      </Link>
                    ) : null}
                    {!n.lida ? (
                      <button
                        type="button"
                        className="text-slate-500 hover:text-slate-300"
                        onClick={() => void markRead(n.id)}
                      >
                        Marcar lida
                      </button>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
