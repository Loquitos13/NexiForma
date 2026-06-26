"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BackofficeShellSkeleton } from "@/components/portal/backoffice-shell-skeleton";
import { FormandoShellSkeleton } from "@/components/portal/formando-shell-skeleton";
import { BackofficeShell } from "@/components/portal/backoffice-shell";
import { FormandoShell } from "@/components/portal/formando-shell";
import { ConsentGate } from "@/components/consent/consent-gate";
import { getAccessToken } from "@/lib/client/access-token";
import { decodeJwtPayload, decodeJwtRole, isFormandoRole } from "@/lib/client/jwt-role";
import { isPortalPathAllowed } from "@/lib/ui/nav-items";
import type { JwtRole } from "@nexiforma/shared";
import { PageContentSkeleton } from "@/components/ui/page-skeleton";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [role, setRole] = useState<JwtRole | null>(() =>
    typeof window !== "undefined" ? decodeJwtRole(getAccessToken()) : null,
  );
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setRole(decodeJwtRole(getAccessToken()));
    setReady(true);
  }, [pathname]);

  const isFormando = isFormandoRole(role);
  const isFormandoRoute = pathname.startsWith("/portal/formando");
  const isDemoRoute = pathname.startsWith("/portal/demo/");

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
    if (!ready || !isFormando) return;
    if (!isFormandoRoute && !isDemoRoute) {
      router.replace("/portal/formando");
    }
  }, [ready, isFormando, isFormandoRoute, isDemoRoute, router]);

  useEffect(() => {
    if (!ready || !role || (role !== "formador" && role !== "comercial")) return;
    if (!isPortalPathAllowed(role, pathname)) {
      router.replace("/acesso-negado");
    }
  }, [ready, role, pathname, router]);

  if (!ready) {
    const formandoPath = pathname.startsWith("/portal/formando");
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

  if (role === "formador" && !isPortalPathAllowed(role, pathname)) {
    return <BackofficeShellSkeleton />;
  }

  if (role === "comercial" && !isPortalPathAllowed(role, pathname)) {
    return <BackofficeShellSkeleton />;
  }

  return (
    <BackofficeShell pathname={pathname} role={role}>
      <ConsentGate>{children}</ConsentGate>
    </BackofficeShell>
  );
}
