"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { bffFetch } from "@/lib/client/bff-fetch";
import { cn } from "@/lib/ui/cn";

type TicketRow = {
  id: string;
  ticketRef: string;
  status: string;
  createdAt: string;
  email: string;
  subject: string;
  bodyPreview: string;
  tenantId: string | null;
  tenant: { slug: string; legalName: string | null };
};

const statusStyle: Record<string, string> = {
  OPEN: "bg-amber-500/15 text-amber-300",
  IN_PROGRESS: "bg-blue-500/15 text-blue-300",
  RESOLVED: "bg-green-500/15 text-green-300",
  CLOSED: "bg-slate-500/15 text-slate-400",
};

export default function PlataformaSuportePage() {
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const r = await bffFetch("/api/v1/control-plane/support-tickets", {
      headers: { accept: "application/json" },
    });
    if (!r.ok) {
      setError(`HTTP ${r.status}`);
      setLoading(false);
      return;
    }
    setTickets((await r.json()) as TicketRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function updateStatus(id: string, status: string) {
    setBusy(id);
    const r = await bffFetch(`/api/v1/control-plane/support-tickets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({ status }),
    });
    setBusy(null);
    if (!r.ok) {
      setError(`HTTP ${r.status}`);
      return;
    }
    await load();
  }

  const openCount = tickets.filter((t) => t.status === "OPEN" || t.status === "IN_PROGRESS").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-50">Suporte</h1>
        <p className="mt-1 text-sm text-slate-500">
          Tickets de utilizadores com dados encriptados em base de dados. Email enviado ao abrir.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-purple-500/10 bg-[#0c0a14]/80 p-4">
          <p className="text-xs uppercase tracking-wider text-slate-500">Abertos</p>
          <p className="text-2xl font-bold text-amber-300">{openCount}</p>
        </div>
        <div className="rounded-2xl border border-purple-500/10 bg-[#0c0a14]/80 p-4">
          <p className="text-xs uppercase tracking-wider text-slate-500">Total</p>
          <p className="text-2xl font-bold text-purple-100">{tickets.length}</p>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/25 bg-red-950/40 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-slate-800/40" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((t) => (
            <div
              key={t.id}
              className="rounded-2xl border border-purple-500/10 bg-[#0c0a14]/80 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-purple-400">{t.ticketRef}</span>
                    <span className={cn("rounded-md px-2 py-0.5 text-[11px] font-medium", statusStyle[t.status])}>
                      {t.status}
                    </span>
                  </div>
                  <h2 className="mt-1 truncate text-sm font-semibold text-slate-100">{t.subject}</h2>
                  <p className="mt-1 text-xs text-slate-500">
                    {t.email} · {t.tenant.legalName ?? t.tenant.slug} ·{" "}
                    {new Date(t.createdAt).toLocaleString("pt-PT")}
                  </p>
                  <p className="mt-2 text-sm text-slate-400">{t.bodyPreview}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {t.tenantId ? (
                    <Link
                      href={`/plataforma/tenantes/${t.tenantId}/operacoes`}
                      className="rounded-lg border border-purple-500/20 px-3 py-1.5 text-xs text-purple-300 hover:bg-purple-500/10"
                    >
                      Ops tenant
                    </Link>
                  ) : null}
                  {t.status === "OPEN" ? (
                    <button
                      type="button"
                      disabled={busy === t.id}
                      onClick={() => void updateStatus(t.id, "IN_PROGRESS")}
                      className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-500 disabled:opacity-50"
                    >
                      Em curso
                    </button>
                  ) : null}
                  {t.status !== "RESOLVED" && t.status !== "CLOSED" ? (
                    <button
                      type="button"
                      disabled={busy === t.id}
                      onClick={() => void updateStatus(t.id, "RESOLVED")}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs text-white hover:bg-emerald-500 disabled:opacity-50"
                    >
                      Resolver
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
          {!tickets.length ? (
            <p className="text-sm text-slate-500">Sem tickets de suporte.</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
