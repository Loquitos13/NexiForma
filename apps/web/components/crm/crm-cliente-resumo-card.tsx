"use client";

import Link from "next/link";
import type { KeyboardEvent, MouseEvent, ReactNode } from "react";
import { Building2, ChevronDown, ExternalLink, Hash, Loader2, Mail } from "lucide-react";
import { cn } from "@/lib/ui/cn";

export type CrmClienteResumoData = {
  id: string;
  nome: string;
  nif: string;
  email: string | null;
  total: number;
};

type Props = {
  cliente: CrmClienteResumoData;
  countLabel: string;
  expanded: boolean;
  onToggle: () => void;
  isNavigating?: boolean;
  fichaHref: string;
  onNavigate?: () => void;
  children?: ReactNode;
};

export function CrmClienteResumoCard({
  cliente,
  countLabel,
  expanded,
  onToggle,
  isNavigating = false,
  fichaHref,
  onNavigate,
  children,
}: Props) {
  const canExpand = cliente.total > 0;
  const isInteractive = canExpand && !isNavigating;

  function handleFichaClick(e: MouseEvent<HTMLAnchorElement>) {
    e.stopPropagation();
    onNavigate?.();
  }

  function handleHeaderKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (!isInteractive) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onToggle();
    }
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border transition-all duration-200",
        expanded ? "border-violet-500/30 bg-slate-900/35" : "border-slate-700/45 bg-slate-900/25",
        isNavigating && "ring-2 ring-violet-500/60 ring-offset-2 ring-offset-slate-950",
      )}
    >
      <div
        role={isInteractive ? "button" : undefined}
        tabIndex={isInteractive ? 0 : undefined}
        aria-expanded={isInteractive ? expanded : undefined}
        onClick={isInteractive ? onToggle : undefined}
        onKeyDown={handleHeaderKeyDown}
        className={cn(
          "relative flex items-start justify-between gap-4 px-4 py-3.5",
          isInteractive &&
            "cursor-pointer transition-colors hover:bg-slate-900/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 focus-visible:ring-inset",
        )}
      >
        {isNavigating ? (
          <span
            className="pointer-events-none absolute inset-0 animate-pulse bg-gradient-to-r from-violet-500/8 via-violet-400/4 to-violet-500/8"
            aria-hidden
          />
        ) : null}

        <div className="relative flex min-w-0 items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-700/50 bg-slate-800/60">
            <Building2
              className={cn("h-4 w-4", isNavigating ? "text-violet-400" : "text-slate-400")}
            />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Cliente</p>
            <p className="truncate text-sm font-semibold text-slate-100">{cliente.nome}</p>
            {expanded ? (
              <div className="mt-1.5 space-y-0.5">
                <p className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Hash className="h-3 w-3 shrink-0 opacity-70" />
                  {cliente.nif}
                </p>
                {cliente.email ? (
                  <p className="flex items-center gap-1.5 truncate text-xs text-slate-500">
                    <Mail className="h-3 w-3 shrink-0 opacity-70" />
                    {cliente.email}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        <div className="relative flex shrink-0 flex-col items-end gap-2">
          {isNavigating ? (
            <Loader2 className="h-5 w-5 animate-spin text-violet-400" aria-hidden />
          ) : (
            <>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide",
                  canExpand
                    ? "border-violet-500/35 bg-violet-950/50 text-violet-200"
                    : "border-slate-700/50 bg-slate-800/40 text-slate-500 opacity-60",
                  expanded && "border-violet-400/45 bg-violet-900/35",
                )}
              >
                <span className="tabular-nums text-violet-300">{cliente.total}</span>
                <span className="text-violet-400/90">{countLabel}</span>
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 text-violet-300/80 transition-transform duration-200",
                    expanded ? "rotate-180" : "-rotate-90",
                  )}
                />
              </span>
              {expanded ? (
                <Link
                  href={fichaHref}
                  onClick={handleFichaClick}
                  className="inline-flex items-center gap-1 text-xs font-medium text-blue-400 hover:text-blue-300 hover:underline"
                >
                  Abrir ficha
                  <ExternalLink className="h-3 w-3" />
                </Link>
              ) : null}
            </>
          )}
        </div>
      </div>

      {expanded && children ? (
        <div className="border-t border-slate-700/40 bg-slate-950/25">{children}</div>
      ) : null}
    </div>
  );
}
