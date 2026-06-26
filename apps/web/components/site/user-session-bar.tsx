"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { PortalNotificationsBell } from "@/components/portal/portal-notifications-bell";
import { bffFetch } from "@/lib/client/bff-fetch";
import { logoutSession } from "@/lib/client/logout";

type MeUser = {
  email?: string;
  role?: string;
  tenantSlug?: string | null;
  displayName?: string | null;
};

type UserSessionBarProps = {
  area: "portal" | "plataforma";
};

export function UserSessionBar({ area }: UserSessionBarProps) {
  const router = useRouter();
  const [user, setUser] = useState<MeUser | null>(null);
  const [busy, setBusy] = useState(false);

  const loadMe = useCallback(async () => {
    const res = await bffFetch("/api/auth/me", { headers: { accept: "application/json" } });
    if (!res.ok) { setUser(null); return; }
    setUser((await res.json()) as MeUser);
  }, []);

  useEffect(() => { void loadMe(); }, [loadMe]);

  async function onLogout() {
    setBusy(true);
    try {
      await logoutSession();
      router.push("/login");
      router.refresh();
    } finally { setBusy(false); }
  }

  const roleLabel = formatRole(user?.role);
  const isPlatform = area === "plataforma";

  return (
    <div className={`flex items-center justify-between gap-3 px-5 py-2 border-b text-xs backdrop-blur-sm ${
      isPlatform
        ? "bg-[#0c0a14]/90 border-purple-500/15"
        : "bg-[#0f172a]/85 border-slate-700/30"
    }`}>
      <div className="flex items-center gap-3 min-w-0">
        <span className="flex items-center gap-1.5 text-slate-400 truncate">
          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
          </svg>
          <span className="truncate">{user?.displayName || user?.email || "Sessão activa"}</span>
        </span>
        {user?.tenantSlug ? (
          <span className="hidden sm:inline-flex items-center gap-1 text-slate-600">
            <span className="w-1 h-1 rounded-full bg-slate-600" />
            {user.tenantSlug}
          </span>
        ) : null}
        {roleLabel ? (
          <span className={`hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
            isPlatform ? "bg-purple-500/10 text-purple-400" : "bg-blue-500/10 text-blue-400"
          }`}>
            {roleLabel}
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-3 flex-shrink-0">
        {area === "portal" ? <PortalNotificationsBell /> : null}
        <Link
          href={isPlatform ? "/plataforma" : "/portal"}
          className="text-slate-400 hover:text-slate-200 transition-colors text-[11px] font-medium"
        >
          Início
        </Link>
        <button
          type="button"
          disabled={busy}
          onClick={() => void onLogout()}
          className="px-2.5 py-1 rounded-md border border-red-500/30 text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
        >
          {busy ? "A sair…" : "Sair"}
        </button>
      </div>
    </div>
  );
}

function formatRole(role?: string): string | null {
  switch (role) {
    case "super_admin": return "Super admin";
    case "tenant_manager": return "Gestor";
    case "comercial": return "Comercial";
    case "formador": return "Formador";
    case "formando": return "Formando";
    default: return role ?? null;
  }
}
