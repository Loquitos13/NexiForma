"use client";

import { cn } from "@/lib/ui/cn";

type NexiFormaBrandTitleProps = {
  className?: string;
  subtitle?: string;
};

/** Título «NexiForma» com gradiente líquido infinito (intro / out). */
export function NexiFormaBrandTitle({ className, subtitle }: NexiFormaBrandTitleProps) {
  return (
    <div className={cn("text-center", className)}>
      <p className="nexi-brand-title text-3xl sm:text-4xl font-bold tracking-tight" aria-label="NexiForma">
        NexiForma
      </p>
      {subtitle ? (
        <p className="mt-1 text-xs font-medium text-purple-400/90 tracking-wide">{subtitle}</p>
      ) : null}
    </div>
  );
}
