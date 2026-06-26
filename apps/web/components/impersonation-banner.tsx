"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { bffFetch } from "@/lib/client/bff-fetch";

type Me = {
  impersonating?: boolean;
  readOnlyImpersonation?: boolean;
  email?: string;
  tenantSlug?: string | null;
};

export function ImpersonationBanner() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await bffFetch("/api/auth/me", { headers: { accept: "application/json" } });
    if (!r.ok) { setMe(null); return; }
    setMe((await r.json()) as Me);
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (!me?.impersonating) return null;

  async function terminar() {
    setBusy(true);
    await bffFetch("/api/auth/impersonation/end", { method: "POST" });
    setBusy(false);
    router.push("/login");
    router.refresh();
  }

  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-yellow-500/10 border-b border-yellow-500/30 text-sm text-yellow-200"
    >
      <span className="flex items-center gap-2">
        <svg className="w-4 h-4 text-yellow-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
        Personificacao activa – <strong className="text-yellow-100">{me.email}</strong>
        {me.tenantSlug ? <span className="text-yellow-400/80">({me.tenantSlug})</span> : null}
        {me.readOnlyImpersonation ? <span className="text-yellow-500 text-xs">· read-only</span> : null}
      </span>
      <button
        type="button"
        onClick={() => void terminar()}
        disabled={busy}
        className="px-3 py-1.5 rounded-lg border border-yellow-500/40 text-xs font-semibold text-yellow-300 hover:bg-yellow-500/10 transition-colors disabled:opacity-50"
      >
        {busy ? "A terminar…" : "Terminar personificacao"}
      </button>
    </div>
  );
}
