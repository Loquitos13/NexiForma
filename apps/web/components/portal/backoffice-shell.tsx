import { ImpersonationBanner } from "@/components/impersonation-banner";
import { UserSessionBar } from "@/components/site/user-session-bar";
import { PortalPushRegister } from "@/components/portal/portal-push-register";
import { Sidebar } from "./sidebar";
import type { JwtRole } from "@nexiforma/shared";

export function BackofficeShell({
  children,
  pathname,
  role,
}: {
  children: React.ReactNode;
  pathname: string;
  role: JwtRole | null;
}) {
  return (
    <div className="flex h-screen min-h-0 overflow-hidden bg-[#070b12]">
      <Sidebar pathname={pathname} role={role} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <UserSessionBar area="portal" />
        <PortalPushRegister />
        <ImpersonationBanner />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl px-6 py-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
