"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { WifiOff } from "lucide-react";
import { UserSessionBar } from "@/components/site/user-session-bar";
import { PortalGlobalSearch } from "@/components/portal/portal-global-search";
import { NavAtmosphere } from "@/components/portal/nav-atmosphere";
import {
  MobileBottomNav,
  MOBILE_BOTTOM_NAV_TEST,
} from "@/components/portal/mobile-bottom-nav";
import { FormandoNav } from "@/components/formando/formando-nav";
import { DocumentosEmFaltaLoginAlert } from "@/components/portal/documentos-em-falta-login-alert";
import { MatriculaInscricaoLoginAlert } from "@/components/portal/matricula-inscricao-login-alert";
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
      <DocumentosEmFaltaLoginAlert />
      <MatriculaInscricaoLoginAlert />
      <div className="ui-portal-top-cluster shrink-0">
        <div className="ui-header-mobile-row relative z-40 border-b lg:hidden">
          <UserSessionBar area="portal" embeddedInAtmosphere />
          <div className="ui-search-strip pointer-events-none absolute inset-x-14 top-1/2 z-[2] flex -translate-y-1/2 justify-center px-2">
            <div className="pointer-events-auto w-full max-w-xs">
              <PortalGlobalSearch pathname={pathname} />
            </div>
          </div>
        </div>

        <div className="ui-header-desktop-row relative z-40 hidden border-b lg:block">
          <UserSessionBar area="portal" embeddedInAtmosphere />
          <div className="ui-search-strip pointer-events-none absolute inset-x-0 top-1/2 z-[2] flex -translate-y-1/2 justify-center px-5">
            <div className={`pointer-events-auto w-full ${contentWidth} max-w-md mx-auto`}>
              <PortalGlobalSearch pathname={pathname} />
            </div>
          </div>
        </div>

        {offline ? (
          <div className="relative z-[1] flex items-center justify-center gap-2 border-b border-amber-500/30 bg-amber-950/30 px-3 py-2 text-xs text-amber-200">
            <WifiOff className="h-3.5 w-3.5 shrink-0" />
            Sem ligação - páginas já visitadas podem continuar disponíveis offline.
          </div>
        ) : null}
      </div>

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
