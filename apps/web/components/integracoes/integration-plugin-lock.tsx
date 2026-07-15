"use client";

import Link from "next/link";
import { Lock } from "lucide-react";

type Props = {
  locked: boolean;
  moduleLabel: string;
  children: React.ReactNode;
};

export function IntegrationPluginLock({ locked, moduleLabel, children }: Props) {
  if (!locked) return <>{children}</>;

  return (
    <div className="group relative">
      <div className="pointer-events-none select-none opacity-45 blur-[0.3px]">{children}</div>
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-xl bg-slate-950/55 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        <Lock className="h-6 w-6 text-amber-400/90" aria-hidden />
        <Link
          href="/portal/billing"
          className="pointer-events-auto rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-violet-500"
        >
          Fazer upgrade - {moduleLabel}
        </Link>
      </div>
    </div>
  );
}

export function IntegrationPluginLockBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-amber-950/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300 ring-1 ring-amber-500/35">
      <Lock className="h-3 w-3" aria-hidden />
      Bloqueado
    </span>
  );
}
