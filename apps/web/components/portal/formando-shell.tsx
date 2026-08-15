"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { WifiOff } from "lucide-react";
import { NexiFormaLogoAnimated } from "@/components/brand/NexiFormaLogoAnimated";
import { UserSessionBar } from "@/components/site/user-session-bar";
import { PortalGlobalSearch } from "@/components/portal/portal-global-search";
import { NavAtmosphere } from "@/components/portal/nav-atmosphere";
import { PortalMobileHeader } from "@/components/portal/portal-mobile-header";
import {
  MobileBottomNav,
  MOBILE_BOTTOM_NAV_TEST,
} from "@/components/portal/mobile-bottom-nav";
import { FormandoNav } from "@/components/formando/formando-nav";
import { useTenantEntitlements } from "@/lib/client/use-tenant-entitlements";
import type { JwtRole } from "@nexiforma/shared";

export function FormandoShell({
  children,
  role,
}: {
  children: React.ReactNode;
  role: JwtRole | null;
}) {
  const pathname = usePathname();
  const { entitlements } = useTenantEntitlements();
  const [offline, setOffline] = useState(false);
  const cursoImersivo = pathname.includes("/portal/formando/aprendizagem/");
  const contentWidth = cursoImersivo ? "max-w-none" : "max-w-4xl";

  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  if (cursoImersivo) {
    return (
      <div className="portal-app-shell">
        <main id="main-content" className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="portal-app-shell ui-shell-atmosphere-host flex min-h-0 flex-col">
      <NavAtmosphere variant="shell" />
      <header className="ui-portal-top-cluster shrink-0">
        <div className="lg:hidden">
          <Suspense fallback={null}>
            <PortalMobileHeader pathname={pathname} role={role} entitlements={entitlements} />
          </Suspense>
        </div>

        <div className="hidden lg:block">
          <div className="ui-themed-topbar relative z-[1] border-b border-slate-700/30 bg-transparent px-3 py-3 sm:px-5 sm:py-3.5">
            <div className={`${contentWidth} mx-auto`}>
              <div className="flex items-center gap-2.5">
                <NexiFormaLogoAnimated
                  size={28}
                  variant="reveal"
                  loop
                  className="shrink-0 drop-shadow-[0_0_12px_rgba(255,71,171,0.3)]"
                />
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-slate-100">NexiForma</div>
                  <div className="text-[10px] text-slate-500">Portal do formando</div>
                </div>
              </div>
            </div>
          </div>
          <UserSessionBar area="portal" embeddedInAtmosphere />
        </div>

        {offline ? (
          <div className="relative z-[1] flex items-center justify-center gap-2 border-b border-amber-500/30 bg-amber-950/30 px-3 py-2 text-xs text-amber-200">
            <WifiOff className="h-3.5 w-3.5 shrink-0" />
            Sem ligação - páginas já visitadas podem continuar disponíveis offline.
          </div>
        ) : null}

        <div className="ui-themed-topbar ui-search-strip relative z-[1] border-b bg-transparent px-3 py-2 sm:px-5">
          <div className={`mx-auto ${contentWidth}`}>
            <PortalGlobalSearch pathname={pathname} className="lg:max-w-xl" />
          </div>
        </div>
      </header>

      <div className="hidden shrink-0 lg:block">
        <Suspense fallback={null}>
          <FormandoNav />
        </Suspense>
      </div>

      <main id="main-content" className="portal-main portal-scroll-main w-full min-w-0 flex-1">
        <div
          className={`mx-auto w-full ${contentWidth} px-3 py-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-5 sm:py-6 lg:pb-6`}
        >
          {children}
        </div>
      </main>

      {MOBILE_BOTTOM_NAV_TEST ? (
        <Suspense fallback={null}>
          <MobileBottomNav pathname={pathname} role={role} entitlements={entitlements} />
        </Suspense>
      ) : null}
    </div>
  );
}
