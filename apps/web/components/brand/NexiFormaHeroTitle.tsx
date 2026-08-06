"use client";

import { FormaFuturoLogoAnimated } from "@/components/brand/FormaFuturoLogoAnimated";
import { NexiFormaLogoAnimated } from "@/components/brand/NexiFormaLogoAnimated";
import { cn } from "@/lib/ui/cn";

type NexiFormaHeroTitleProps = {
  className?: string;
};

/** Hero - Nexi Forma by FormaFuturo. */
export function NexiFormaHeroTitle({ className }: NexiFormaHeroTitleProps) {
  return (
    <div className={cn("nexi-hero-title mb-5 flex w-full max-w-2xl flex-col", className)}>
      <h1
        className="flex flex-wrap items-center gap-4 sm:gap-5"
        aria-label="Nexi Forma"
      >
        <NexiFormaLogoAnimated
          size={112}
          variant="reveal"
          loop
          className="shrink-0 drop-shadow-[0_0_28px_rgba(255,71,171,0.35)]"
        />
        <span className="text-4xl font-extrabold tracking-tight text-slate-50 sm:text-5xl leading-none">
          Nexi Forma
        </span>
      </h1>

      <div
        className="my-4 flex w-full items-center gap-3"
        aria-label="by FormaFuturo"
      >
        <span className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-500/70 to-slate-500/70" />
        <span className="shrink-0 px-1 text-sm font-medium tracking-[0.18em] text-slate-400 lowercase">
          by
        </span>
        <span className="h-px flex-1 bg-gradient-to-l from-transparent via-slate-500/70 to-slate-500/70" />
      </div>

      <div className="flex w-full justify-center">
        <FormaFuturoLogoAnimated width={360} loop />
      </div>
    </div>
  );
}
