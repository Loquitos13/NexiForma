import { NexiFormaLogoAnimated } from "@/components/brand/NexiFormaLogoAnimated";
import { UserSessionBar } from "@/components/site/user-session-bar";

export function FormandoShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-[#070b12]">
      <header className="px-5 py-3.5 border-b border-slate-700/30 bg-slate-950/90">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-2.5">
            <NexiFormaLogoAnimated
              size={28}
              variant="reveal"
              loop
              className="shrink-0 drop-shadow-[0_0_12px_rgba(255,71,171,0.3)]"
            />
            <div>
              <div className="text-sm font-bold text-slate-100">NexiForma</div>
              <div className="text-[10px] text-slate-500">Portal do formando</div>
            </div>
          </div>
        </div>
      </header>
      <UserSessionBar area="portal" />
      <div className="flex-1 w-full">{children}</div>
    </div>
  );
}
