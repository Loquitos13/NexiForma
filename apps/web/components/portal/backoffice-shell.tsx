"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { ImpersonationBanner } from "@/components/impersonation-banner";
import { UserSessionBar } from "@/components/site/user-session-bar";
import { PortalPushRegister } from "@/components/portal/portal-push-register";
import { PortalGlobalSearch } from "@/components/portal/portal-global-search";
import { NavAtmosphere } from "@/components/portal/nav-atmosphere";
import { PortalMobileHeader } from "@/components/portal/portal-mobile-header";
import {
  MobileBottomNav,
  MOBILE_BOTTOM_NAV_TEST,
} from "@/components/portal/mobile-bottom-nav";
import { publishMobileNavOpen } from "@/lib/client/mobile-nav";
import { Sidebar } from "./sidebar";
import { useTenantEntitlements } from "@/lib/client/use-tenant-entitlements";
import { cn } from "@/lib/ui/cn";
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
  const scrollRef = useRef<HTMLElement | null>(null);
  /** Com bottom nav activa, o drawer lateral em mobile fica desligado. */
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    publishMobileNavOpen(mobileNavOpen);
    return () => publishMobileNavOpen(false);
  }, [mobileNavOpen]);

  const isWideSettingsPage = pathname.startsWith("/portal/configuracoes");

  return (
    <div className="portal-app-shell ui-shell-atmosphere-host flex-row">
      <NavAtmosphere variant="shell" />
      <Sidebar
        pathname={pathname}
        role={role}
        entitlements={entitlements}
        mobileOpen={MOBILE_BOTTOM_NAV_TEST ? false : mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
      />
      <div className="flex min-h-0 min-w-0 w-full max-w-full flex-1 flex-col overflow-hidden">
        <div className="ui-portal-top-cluster relative z-40 shrink-0">
          {/* Mobile: logo + badge + crumbs + avatar - sempre visível */}
          <div className="lg:hidden">
            <Suspense fallback={null}>
              <PortalMobileHeader
                pathname={pathname}
                role={role}
                entitlements={entitlements}
              />
            </Suspense>
          </div>

          {/* Desktop: identidade + acções; search centrada na mesma fila */}
          <div className="ui-header-desktop-row relative z-40 hidden border-b lg:block">
            <UserSessionBar area="portal" embeddedInAtmosphere />
            <div className="ui-search-strip pointer-events-none absolute inset-x-0 top-1/2 z-[2] flex -translate-y-1/2 justify-center px-5">
              <div className="pointer-events-auto w-full max-w-md">
                <PortalGlobalSearch pathname={pathname} />
              </div>
            </div>
          </div>

          {/* Mobile: search sempre visível */}
          <div className="ui-themed-topbar ui-search-strip relative z-[1] border-b bg-transparent px-3 py-2 lg:hidden">
            <PortalGlobalSearch pathname={pathname} className="mx-auto max-w-xl" />
          </div>
        </div>
        <PortalPushRegister />
        <ImpersonationBanner />
        <main
          id="main-content"
          ref={scrollRef}
          className="portal-main portal-scroll-main"
        >
          <div
            className={cn(
              "mx-auto w-full px-3 py-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-6",
              isWideSettingsPage ? "max-w-[90rem]" : "max-w-6xl",
            )}
          >
            {children}
          </div>
        </main>
      </div>
      {MOBILE_BOTTOM_NAV_TEST ? (
        <MobileBottomNav pathname={pathname} role={role} entitlements={entitlements} />
      ) : null}
    </div>
  );
}

export type { TenantEntitlements };
