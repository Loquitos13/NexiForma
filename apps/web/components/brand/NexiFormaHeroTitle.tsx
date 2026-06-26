"use client";

import { NexiFormaLogoAnimated } from "@/components/brand/NexiFormaLogoAnimated";
import { cn } from "@/lib/ui/cn";

type NexiFormaHeroTitleProps = {
  className?: string;
};

/** Hero - logo NF com o mesmo efeito de energia do login. */
export function NexiFormaHeroTitle({ className }: NexiFormaHeroTitleProps) {
  return (
    <h1
      className={cn(
        "nexi-hero-title mb-5 flex flex-wrap items-center gap-4 sm:gap-5 lg:gap-6",
        className,
      )}
      aria-label="Nexi Forma"
    >
      <NexiFormaLogoAnimated
        size={128}
        variant="reveal"
        loop
        className="shrink-0 drop-shadow-[0_0_28px_rgba(255,71,171,0.35)]"
      />
      <span className="text-4xl font-extrabold tracking-tight text-slate-50 sm:text-5xl lg:text-6xl leading-none">
        Nexi Forma
      </span>
    </h1>
  );
}
