"use client";

import {
  a4AspectRatio,
  type DocumentOrientacao,
} from "@nexiforma/shared";
import { cn } from "@/lib/ui/cn";

type Props = {
  srcDoc: string;
  orientacao?: DocumentOrientacao;
  title?: string;
  className?: string;
  /** Largura máxima do contentor (px). A página escala para caber. */
  maxWidth?: number;
};

export function DocumentPagePreview({
  srcDoc,
  orientacao = "portrait",
  title = "Pré-visualização",
  className,
  maxWidth = 520,
}: Props) {
  const aspect = a4AspectRatio(orientacao);

  return (
    <div className={cn("space-y-1.5", className)}>
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
        Pré-visualização A4 {orientacao === "landscape" ? "horizontal" : "vertical"}
      </p>
      <div
        className="mx-auto overflow-hidden rounded-lg border border-slate-600/50 bg-slate-800/40 shadow-inner"
        style={{ maxWidth }}
      >
        <div className="relative w-full bg-white" style={{ aspectRatio: aspect }}>
          <iframe
            title={title}
            srcDoc={srcDoc}
            className="absolute inset-0 h-full w-full border-0 bg-white"
            sandbox=""
            referrerPolicy="no-referrer"
          />
        </div>
      </div>
    </div>
  );
}
