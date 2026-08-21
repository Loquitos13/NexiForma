"use client";

import { GraduationCap, Lock, Video } from "lucide-react";
import type { IntegrationPluginDef, IntegrationPluginId } from "@nexiforma/shared";
import { cn } from "@/lib/ui/cn";

const ICONS: Record<IntegrationPluginId, typeof Video> = {
  salas_online: Video,
  moodle: GraduationCap,
};

type Props = {
  plugin: IntegrationPluginDef;
  unlocked: boolean;
  statusLabel: string;
  statusTone: "active" | "idle" | "locked";
  selected?: boolean;
  onSelect: () => void;
};

export function PluginStoreCard({ plugin, unlocked, statusLabel, statusTone, selected, onSelect }: Props) {
  const Icon = ICONS[plugin.id];

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group flex h-full flex-col rounded-2xl border bg-slate-900/50 p-4 text-left transition-all",
        "hover:border-violet-500/40 hover:bg-slate-900/80 hover:shadow-lg hover:shadow-violet-950/20",
        selected ? "border-violet-500/50 ring-1 ring-violet-500/30" : "border-slate-700/50",
        !unlocked && "opacity-90",
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl",
            unlocked ? "bg-gradient-to-br from-violet-600/30 to-blue-600/20" : "bg-slate-800/80",
          )}
        >
          {unlocked ? (
            <Icon className="h-7 w-7 text-violet-300" aria-hidden />
          ) : (
            <Lock className="h-6 w-6 text-amber-400/80" aria-hidden />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-100">{plugin.title}</p>
          <p className="text-[11px] text-slate-500">{plugin.publisher}</p>
          <p className="mt-1 text-xs text-slate-400 line-clamp-2">{plugin.tagline}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <span className="rounded-md bg-slate-800/80 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">
          {plugin.category}
        </span>
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-[10px] font-semibold",
            statusTone === "active" && "bg-emerald-500/15 text-emerald-300",
            statusTone === "idle" && "bg-slate-700/60 text-slate-400",
            statusTone === "locked" && "bg-amber-500/15 text-amber-300",
          )}
        >
          {statusLabel}
        </span>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-slate-500 line-clamp-2 group-hover:text-slate-400">
        {plugin.description}
      </p>
    </button>
  );
}
