"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BackofficeShellSkeleton } from "@/components/portal/backoffice-shell-skeleton";
import { FormandoShellSkeleton } from "@/components/portal/formando-shell-skeleton";
import { BackofficeShell } from "@/components/portal/backoffice-shell";
import { FormandoShell } from "@/components/portal/formando-shell";
import { ConsentGate } from "@/components/consent/consent-gate";
import { getAccessToken } from "@/lib/client/access-token";
import { isAccessTokenExpired } from "@/lib/client/session-lifecycle";
import {
  TenantEntitlementsProvider,
  useTenantEntitlements,
} from "@/lib/client/use-tenant-entitlements";
import { decodeJwtPayload, decodeJwtRole, isFormandoRole } from "@/lib/client/jwt-role";
import { isPortalPathAllowed } from "@/lib/ui/nav-items";
import { defaultPortalHome, isFormandoPortalPath, roleLandingPath } from "@nexiforma/shared";
import type { JwtRole } from "@nexiforma/shared";
import { PageContentSkeleton } from "@/components/ui/page-skeleton";
import { markSessionExpired } from "@/lib/client/session-lifecycle";
import { useTenantRole } from "@/lib/client/use-tenant-role";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <TenantEntitlementsProvider>
      <PortalLayoutInner>{children}</PortalLayoutInner>
    </TenantEntitlementsProvider>
  );
}

function PortalLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { entitlements, loading: entitlementsLoading } = useTenantEntitlements();
  const { role: authRole, loading: authLoading, sessionExpired } = useTenantRole();
  const [role, setRole] = useState<JwtRole | null>(() => {
    if (typeof window === "undefined") return null;
    const token = getAccessToken();
    if (!token || isAccessTokenExpired(token)) return null;
    return decodeJwtRole(token);
  });
  const [ready, setReady] = useState(false);

  const isFormando = isFormandoRole(role);
  const isFormandoRoute = isFormandoPortalPath(pathname);
  const isDemoRoute = pathname.startsWith("/portal/demo/");

  useEffect(() => {
    if (authRole) setRole(authRole);
    else if (sessionExpired) setRole(null);
    else setRole(decodeJwtRole(getAccessToken()));
    setReady(true);
  }, [pathname, authRole, sessionExpired]);

  useEffect(() => {
    if (!authLoading && sessionExpired) {
      markSessionExpired({ returnTo: pathname });
    }
  }, [authLoading, sessionExpired, pathname]);

  useEffect(() => {
    if (!ready) return;
    const payload = decodeJwtPayload(getAccessToken());
    if (
      payload?.role === "super_admin" &&
      payload?.kind === "platform" &&
      !payload?.impersonating
    ) {
      router.replace("/plataforma");
    }
  }, [ready, router]);

  useEffect(() => {
    if (!ready || entitlementsLoading || !entitlements || !role) return;

    if (isFormando) {
      if (!isFormandoRoute && !isDemoRoute) {
        router.replace(defaultPortalHome(entitlements, role));
      }
      return;
    }

    if (isFormandoRoute) {
      router.replace(roleLandingPath(role, decodeJwtPayload(getAccessToken())?.kind ?? null));
      return;
    }

    if (!isPortalPathAllowed(role, pathname, entitlements)) {
      const payload = decodeJwtPayload(getAccessToken());
      router.replace(roleLandingPath(role, payload?.kind ?? null));
    }
  }, [ready, entitlementsLoading, entitlements, role, pathname, router, isFormando, isFormandoRoute, isDemoRoute]);

  useEffect(() => {
    if (!ready || entitlementsLoading || !entitlements || !role) return;
    if (pathname !== "/portal" && pathname !== "/portal/") return;
    const home = defaultPortalHome(entitlements, role);
    if (home !== "/portal") {
      router.replace(home);
    }
  }, [ready, entitlementsLoading, entitlements, role, pathname, router]);

  if (authLoading && !role) {
    const formandoPath = isFormandoPortalPath(pathname);
    return formandoPath ? <FormandoShellSkeleton /> : <BackofficeShellSkeleton />;
  }

  if (sessionExpired) {
    return null;
  }

  if (!ready || (role && role !== "super_admin" && entitlementsLoading)) {
    const formandoPath = isFormandoPortalPath(pathname);
    return formandoPath ? <FormandoShellSkeleton /> : <BackofficeShellSkeleton />;
  }

  if (isFormando) {
    if (!isFormandoRoute && !isDemoRoute) {
      return (
        <FormandoShell>
          <main className="mx-auto max-w-[720px] flex-1 px-5 py-6">
            <PageContentSkeleton variant="default" />
          </main>
        </FormandoShell>
      );
    }
    if (isDemoRoute) return children;
    return (
      <FormandoShell>
        <ConsentGate>{children}</ConsentGate>
      </FormandoShell>
    );
  }

  if (isDemoRoute) return children;

  if (role && entitlements && !isPortalPathAllowed(role, pathname, entitlements)) {
    return <BackofficeShellSkeleton />;
  }

  return (
    <BackofficeShell pathname={pathname} role={role}>
      <ConsentGate>{children}</ConsentGate>
    </BackofficeShell>
  );
}
