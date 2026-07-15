"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { NexiFormaLogoAnimated } from "@/components/brand/NexiFormaLogoAnimated";
import { canAccessPlatformArea } from "@nexiforma/shared";
import { getAccessToken } from "@/lib/client/access-token";
import { decodeJwtPayload } from "@/lib/client/jwt-role";
import { useTenantRole } from "@/lib/client/use-tenant-role";
import { markSessionExpired } from "@/lib/client/session-lifecycle";
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

  if (sessionExpired) {
    return null;
  }

  if (!ready || !allowed) {
    return <PlataformaShellSkeleton />;
  }

  return (
    <div className="portal-app-shell flex-row bg-[#0c0a14]">
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
          "portal-fixed-drawer flex w-[min(88vw,17rem)] flex-col border-r border-purple-500/15 bg-[#0c0a14]/98 transition-transform duration-300 lg:h-full lg:w-56 lg:flex-shrink-0",
          mobileNavOpen ? "translate-x-0" : "max-lg:-translate-x-full",
        )}
      >
        <div className="px-4 py-5">
          <div className="flex items-center gap-2.5">
            <NexiFormaLogoAnimated
              size={28}
              variant="reveal"
              loop
              className="shrink-0 drop-shadow-[0_0_12px_rgba(255,71,171,0.3)]"
            />
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-purple-100">Control Plane</div>
              <div className="text-[10px] text-purple-400/60">NexiForma</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 pb-4">
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
                  active
                    ? "bg-purple-500/20 font-semibold text-purple-200"
                    : "text-slate-400 hover:bg-white/5 hover:text-slate-200",
                )}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full", active ? "bg-purple-400" : "bg-slate-700")} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="portal-mobile-bar flex items-center gap-2 border-b border-purple-500/15 bg-[#0c0a14]/95 px-3 py-2 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="rounded-lg p-2 text-purple-200 hover:bg-white/5"
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="truncate text-sm font-semibold text-purple-100">Control Plane</span>
        </div>
        <UserSessionBar area="plataforma" />
        <main className="portal-main portal-scroll-main">
          <div className="mx-auto max-w-6xl px-3 py-4 sm:px-6 sm:py-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
