"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { NexiFormaLogoAnimated } from "@/components/brand/NexiFormaLogoAnimated";
import { canAccessPlatformArea } from "@nexiforma/shared";
import { getAccessToken } from "@/lib/client/access-token";
import { decodeJwtPayload } from "@/lib/client/jwt-role";
import { cn } from "@/lib/ui/cn";
import { UserSessionBar } from "@/components/site/user-session-bar";
import { PlataformaShellSkeleton } from "@/components/plataforma/plataforma-shell-skeleton";

const NAV = [
  { href: "/plataforma", label: "Dashboard" },
  { href: "/plataforma/tenantes", label: "Tenants" },
  { href: "/plataforma/rgpd", label: "RGPD" },
  { href: "/plataforma/auditoria", label: "Auditoria" },
] as const;

export default function PlataformaLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const payload = decodeJwtPayload(getAccessToken());
    const ok = canAccessPlatformArea(payload?.role, payload?.kind);
    setAllowed(ok);
    setReady(true);
    if (!ok) router.replace("/acesso-negado");
  }, [pathname, router]);

  if (!ready || !allowed) {
    return <PlataformaShellSkeleton />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#0c0a14]">
      <aside className="flex w-[220px] flex-shrink-0 flex-col border-r border-purple-500/15 bg-[#0c0a14]/95">
        <div className="px-4 py-5">
          <div className="flex items-center gap-2.5">
            <NexiFormaLogoAnimated
              size={28}
              variant="reveal"
              loop
              className="shrink-0 drop-shadow-[0_0_12px_rgba(255,71,171,0.3)]"
            />
            <div>
              <div className="text-sm font-bold text-purple-100">Control Plane</div>
              <div className="text-[10px] text-purple-400/60">NexiForma</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-2 pb-4">
          {NAV.map((item) => {
            const active =
              item.href === "/plataforma"
                ? pathname === "/plataforma"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-purple-500/20 text-purple-200 font-semibold"
                    : "text-slate-400 hover:bg-white/5 hover:text-slate-200",
                )}
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    active ? "bg-purple-400" : "bg-slate-700",
                  )}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <UserSessionBar area="plataforma" />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-5xl px-6 py-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
