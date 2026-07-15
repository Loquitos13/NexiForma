"use client";

import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { ImpersonationBanner } from "@/components/impersonation-banner";
import { UserSessionBar } from "@/components/site/user-session-bar";
import { PortalPushRegister } from "@/components/portal/portal-push-register";
import { PortalGlobalSearch } from "@/components/portal/portal-global-search";
import { Sidebar } from "./sidebar";
import { useTenantEntitlements } from "@/lib/client/use-tenant-entitlements";
import type { JwtRole, TenantEntitlements } from "@nexiforma/shared";

export function BackofficeShell({
  children,
  pathname,
  role,
}: {
  children: React.ReactNode;
  pathname: string;
  role: JwtRole | null;
}) {
  const { entitlements } = useTenantEntitlements();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  return (
    <div className="portal-app-shell flex-row bg-[#070b12]">
      <Sidebar
        pathname={pathname}
        role={role}
        entitlements={entitlements}
        mobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="portal-mobile-bar flex items-center gap-2 border-b border-slate-700/30 bg-slate-950/90 px-3 py-2 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="rounded-lg p-2 text-slate-300 hover:bg-slate-800/60"
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="truncate text-sm font-semibold text-slate-200">NexiForma</span>
        </div>
        <UserSessionBar area="portal" />
        <div className="border-b border-slate-800/80 bg-[#0a0f18]/90 px-3 py-2 sm:px-5">
          <PortalGlobalSearch pathname={pathname} className="mx-auto max-w-xl" />
        </div>
        <PortalPushRegister />
        <ImpersonationBanner />
        <main className="portal-main portal-scroll-main">
          <div className="mx-auto max-w-6xl px-3 py-4 sm:px-6 sm:py-6">{children}</div>
        </main>
      </div>
    </div>
  );
}

export type { TenantEntitlements };
