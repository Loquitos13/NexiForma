"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { NexiFormaLogoAnimated } from "@/components/brand/NexiFormaLogoAnimated";
import { TenantSubscriptionBadge } from "@/components/portal/tenant-subscription-badge";
import {
  PortalUserMenu,
  portalUserInitials,
} from "@/components/portal/portal-user-menu";
import { bffFetch } from "@/lib/client/bff-fetch";
import { subscribeSessionExpired } from "@/lib/client/session-lifecycle";
import { usePortalNotifications } from "@/lib/client/use-portal-notifications";
import { DocPendenteNeonDot } from "@/components/portal/doc-pendente-neon-dot";
import { useDocumentosObrigatorios } from "@/components/portal/documentos-obrigatorios-gate";
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
  const searchParams = useSearchParams();
  const [user, setUser] = useState<MeUser | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const { hasActivity, totalBadgeCount } = usePortalNotifications();
  const { emFaltaCount, roleKind } = useDocumentosObrigatorios();
  const docsPendentes =
    emFaltaCount > 0 && (roleKind === "formando" || roleKind === "formador");

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

  const crumb = resolvePortalBreadcrumb(pathname, role, entitlements, searchParams);
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
          className="portal-user-avatar relative shrink-0 text-xs font-bold transition-transform active:scale-95"
          aria-label="Abrir menu da conta"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(true)}
        >
          {portalUserInitials(user)}
          {docsPendentes ? (
            <span
              className="pointer-events-none absolute -bottom-0.5 -left-0.5 flex h-2.5 w-2.5"
              title="Documentos obrigatórios em falta"
            >
              <DocPendenteNeonDot className="h-2 w-2" />
            </span>
          ) : null}
          {hasActivity ? (
            <span
              className="pointer-events-none absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center"
              title={`${totalBadgeCount} notificações / alertas por ver`}
            >
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-pink-400 opacity-80 duration-1000" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-gradient-to-tr from-pink-600 to-rose-400 ring-2 ring-[var(--ui-panel,#0f172a)] shadow-[0_0_10px_rgba(244,63,94,0.9)]" />
            </span>
          ) : null}
        </button>
      </header>

      <PortalUserMenu open={menuOpen} onClose={() => setMenuOpen(false)} user={user} />
    </>
  );
}
