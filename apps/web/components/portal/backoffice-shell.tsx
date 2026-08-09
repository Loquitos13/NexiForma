"use client";

import { useEffect, useRef, useState } from "react";
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
import { useHeaderScrollCollapse } from "@/lib/client/use-header-scroll-collapse";
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
  const headerCollapsed = useHeaderScrollCollapse(scrollRef);
  /** Com bottom nav activa, o drawer lateral em mobile fica desligado. */
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    publishMobileNavOpen(mobileNavOpen);
    return () => publishMobileNavOpen(false);
  }, [mobileNavOpen]);

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
        <div
          className={cn(
            "ui-portal-top-cluster shrink-0",
            headerCollapsed && "is-header-collapsed",
          )}
        >
          {/* Mobile: logo + badge + crumbs + avatar */}
          <div className="ui-header-collapsible lg:hidden">
            <PortalMobileHeader
              pathname={pathname}
              role={role}
              entitlements={entitlements}
            />
          </div>

          {/* Desktop: session bar; search centrada na mesma fila */}
          <div className="ui-header-desktop-row relative z-[1] hidden border-b lg:block">
            <div className="ui-header-collapsible">
              <UserSessionBar area="portal" embeddedInAtmosphere />
            </div>
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
          <div className="mx-auto w-full max-w-6xl px-3 py-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-6">
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
