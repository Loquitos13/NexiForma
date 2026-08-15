"use client";

import { cn } from "@/lib/ui/cn";

/** Indicador neon de documentos obrigatórios em falta. */
export function DocPendenteNeonDot({
  className,
  title = "Documentos obrigatórios em falta",
}: {
  className?: string;
  title?: string;
}) {
  return (
    <span
      className={cn("relative inline-flex h-2 w-2 shrink-0", className)}
      title={title}
      aria-label={title}
    >
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#39ff14] opacity-75" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-[#39ff14] shadow-[0_0_8px_rgba(57,255,20,0.9)]" />
    </span>
  );
}
