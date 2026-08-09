"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { NexiFormaLogoAnimated } from "@/components/brand/NexiFormaLogoAnimated";
import { NavAtmosphere } from "@/components/portal/nav-atmosphere";
import { MobileNavToggle } from "@/components/portal/mobile-nav-toggle";
import { canAccessPlatformArea } from "@nexiforma/shared";
import { getAccessToken } from "@/lib/client/access-token";
import { decodeJwtPayload } from "@/lib/client/jwt-role";
import { useTenantRole } from "@/lib/client/use-tenant-role";
import { markSessionExpired } from "@/lib/client/session-lifecycle";
import { publishMobileNavOpen } from "@/lib/client/mobile-nav";
import { cn } from "@/lib/ui/cn";
import { UserSessionBar } from "@/components/site/user-session-bar";
import { PlataformaShellSkeleton } from "@/components/plataforma/plataforma-shell-skeleton";

const NAV = [
  { href: "/plataforma", label: "Dashboard" },
  { href: "/plataforma/crm", label: "CRM" },
  { href: "/plataforma/operacoes", label: "Operações" },
  { href: "/plataforma/suporte", label: "Suporte" },
  { href: "/plataforma/tenantes", label: "Tenants" },
  { href: "/plataforma/rgpd", label: "RGPD" },
  { href: "/plataforma/auditoria", label: "Auditoria" },
  { href: "/plataforma/conta", label: "Conta" },
] as const;

export default function PlataformaLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { sessionExpired, loading: authLoading } = useTenantRole();
  const [ready, setReady] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => setIsDesktop(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const drawerHidden = !isDesktop && !mobileNavOpen;

  useEffect(() => {
    const payload = decodeJwtPayload(getAccessToken());
    const ok = canAccessPlatformArea(payload?.role, payload?.kind);
    setAllowed(ok);
    setReady(true);
    if (!ok && !sessionExpired) router.replace("/acesso-negado");
  }, [pathname, router, sessionExpired]);

  useEffect(() => {
    if (!authLoading && sessionExpired) {
      markSessionExpired({ returnTo: pathname });
    }
  }, [authLoading, sessionExpired, pathname]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    publishMobileNavOpen(mobileNavOpen);
    return () => publishMobileNavOpen(false);
  }, [mobileNavOpen]);

  if (sessionExpired) {
    return null;
  }

  if (!ready || !allowed) {
    return <PlataformaShellSkeleton />;
  }

  return (
    <div className="portal-app-shell ui-shell-atmosphere-host flex-row">
      <NavAtmosphere variant="shell" />
      {mobileNavOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          aria-label="Fechar menu"
          onClick={() => setMobileNavOpen(false)}
        />
      ) : null}
      <aside
        className={cn(
          "portal-fixed-drawer ui-themed-sidebar ui-nav-atmosphere-host flex w-[min(88vw,17rem)] flex-col border-r transition-transform duration-300 lg:h-full lg:w-56 lg:flex-shrink-0",
          mobileNavOpen ? "translate-x-0" : "max-lg:-translate-x-full",
        )}
        aria-hidden={drawerHidden}
        inert={drawerHidden ? true : undefined}
      >
        <NavAtmosphere />
        <div className="ui-nav-brand-slot relative z-[1] flex items-center gap-2 px-4 py-5">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <NexiFormaLogoAnimated
              size={28}
              variant="reveal"
              loop
              className="shrink-0"
            />
            <div className="min-w-0">
              <div className="ui-nav-brand truncate text-sm font-bold">Control Plane</div>
              <div className="ui-nav-brand-sub text-[10px]">Superadmin</div>
            </div>
          </div>
          {mobileNavOpen ? (
            <MobileNavToggle
              variant="close"
              onClick={() => setMobileNavOpen(false)}
            />
          ) : null}
        </div>

        <nav aria-label="Menu da plataforma" className="ui-themed-scroll relative z-[1] flex-1 px-2 pb-4">
          {NAV.map((item) => {
            const active =
              item.href === "/plataforma" ? pathname === "/plataforma" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileNavOpen(false)}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                  active ? "ui-nav-item-active font-semibold" : "ui-nav-item",
                )}
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    active ? "ui-nav-dot-active" : "ui-nav-dot",
                  )}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-h-0 min-w-0 w-full max-w-full flex-1 flex-col overflow-hidden">
        <div className="ui-portal-top-cluster shrink-0">
          <div className="portal-mobile-bar ui-themed-topbar relative z-[1] flex items-center gap-2 border-b bg-transparent px-3 py-2 lg:hidden">
            <MobileNavToggle variant="open" onClick={() => setMobileNavOpen(true)} />
            <span className="ui-nav-brand truncate text-sm font-semibold">Control Plane</span>
          </div>
          <UserSessionBar area="plataforma" embeddedInAtmosphere />
        </div>
        <main id="main-content" className="portal-main portal-scroll-main">
          <div className="mx-auto w-full max-w-6xl px-3 py-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
