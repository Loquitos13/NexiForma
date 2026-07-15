"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { WifiOff } from "lucide-react";
import { NexiFormaLogoAnimated } from "@/components/brand/NexiFormaLogoAnimated";
import { UserSessionBar } from "@/components/site/user-session-bar";
import { PortalGlobalSearch } from "@/components/portal/portal-global-search";

export function FormandoShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [offline, setOffline] = useState(false);
  const cursoImersivo = pathname.includes("/portal/formando/aprendizagem/");
  const contentWidth = cursoImersivo ? "max-w-none" : "max-w-4xl";

  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  if (cursoImersivo) {
    return (
      <div className="portal-app-shell bg-[#070b12]">
        <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
      </div>
    );
  }

  return (
    <div className="portal-app-shell bg-[#070b12]">
      <header className="shrink-0 border-b border-slate-700/30 bg-slate-950/90 px-3 py-3 sm:px-5 sm:py-3.5">
        <div className={`${contentWidth} mx-auto`}>
          <div className="flex items-center gap-2.5">
            <NexiFormaLogoAnimated
              size={28}
              variant="reveal"
              loop
              className="shrink-0 drop-shadow-[0_0_12px_rgba(255,71,171,0.3)]"
            />
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-slate-100">NexiForma</div>
              <div className="text-[10px] text-slate-500">Portal do formando</div>
            </div>
          </div>
        </div>
      </header>
      <UserSessionBar area="portal" />
      {offline ? (
        <div className="flex items-center justify-center gap-2 border-b border-amber-500/30 bg-amber-950/30 px-3 py-2 text-xs text-amber-200">
          <WifiOff className="h-3.5 w-3.5 shrink-0" />
          Sem ligação — páginas já visitadas podem continuar disponíveis offline.
        </div>
      ) : null}
      <div className="shrink-0 border-b border-slate-800/80 bg-[#0a0f18]/90 px-3 py-2 sm:px-5">
        <div className={`mx-auto ${contentWidth}`}>
          <PortalGlobalSearch pathname={pathname} />
        </div>
      </div>
      <div className="portal-scroll-main w-full">{children}</div>
    </div>
  );
}
