"use client";

import { useCallback, useEffect, useState } from "react";
import { NexiFormaLogoAnimated } from "@/components/brand/NexiFormaLogoAnimated";
import { TenantSubscriptionBadge } from "@/components/portal/tenant-subscription-badge";
import {
  PortalUserMenu,
  portalUserInitials,
} from "@/components/portal/portal-user-menu";
import { bffFetch } from "@/lib/client/bff-fetch";
import { subscribeSessionExpired } from "@/lib/client/session-lifecycle";
import { resolvePortalBreadcrumb } from "@/lib/ui/nav-items";
import { cn } from "@/lib/ui/cn";
import type { JwtRole, TenantEntitlements } from "@nexiforma/shared";

type MeUser = {
  email?: string;
  role?: string;
  kind?: string;
  displayName?: string | null;
};

type Props = {
  pathname: string;
  role: JwtRole | null;
  entitlements?: TenantEntitlements | null;
  className?: string;
};

export function PortalMobileHeader({
  pathname,
  role,
  entitlements,
  className,
}: Props) {
  const [user, setUser] = useState<MeUser | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const loadMe = useCallback(async () => {
    const res = await bffFetch("/api/auth/me", { headers: { accept: "application/json" } });
    if (!res.ok) {
      setUser(null);
      return;
    }
    setUser((await res.json()) as MeUser);
  }, []);

  useEffect(() => {
    void loadMe();
    return subscribeSessionExpired(() => setUser(null));
  }, [loadMe]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const crumb = resolvePortalBreadcrumb(pathname, role, entitlements);
  const crumbLabel = crumb
    ? `${crumb.group} > ${crumb.item}`
    : "Portal";

  return (
    <>
      <header
        className={cn(
          "portal-mobile-header ui-themed-topbar relative z-[1] flex items-center gap-2 border-b bg-transparent px-3 py-2.5",
          className,
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <NexiFormaLogoAnimated
            size={28}
            variant="reveal"
            loop
            className="shrink-0 drop-shadow-[0_0_12px_rgba(255,71,171,0.28)]"
          />
          <TenantSubscriptionBadge className="shrink-0" />
        </div>

        <div
          className="portal-mobile-breadcrumb max-w-[42%] truncate rounded-lg border border-[color:var(--ui-border)] bg-[color:color-mix(in_srgb,var(--ui-panel)_55%,transparent)] px-2.5 py-1 text-[11px] text-[color:var(--ui-muted)]"
          title={crumbLabel}
        >
          {crumbLabel}
        </div>

        <button
          type="button"
          className="portal-user-avatar shrink-0 text-xs font-bold"
          aria-label="Abrir menu da conta"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(true)}
        >
          {portalUserInitials(user)}
        </button>
      </header>

      <PortalUserMenu open={menuOpen} onClose={() => setMenuOpen(false)} user={user} />
    </>
  );
}
