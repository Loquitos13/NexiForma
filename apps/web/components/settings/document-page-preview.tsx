"use client";

import { memo, useEffect, useRef, useState } from "react";
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
  maxWidth?: number;
  /** Adia montagem do iframe (melhora performance inicial). */
  lazy?: boolean;
  hideLabel?: boolean;
};

function DocumentPagePreviewInner({
  srcDoc,
  orientacao = "portrait",
  title = "Pré-visualização",
  className,
  maxWidth = 520,
  lazy = false,
  hideLabel = false,
}: Props) {
  const aspect = a4AspectRatio(orientacao);
  const [mounted, setMounted] = useState(!lazy);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastSrcRef = useRef(srcDoc);

  useEffect(() => {
    if (!lazy) {
      setMounted(true);
      return;
    }
    const node = containerRef.current;
    if (!node) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setMounted(true);
          obs.disconnect();
        }
      },
      { rootMargin: "120px" },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [lazy]);

  if (srcDoc !== lastSrcRef.current) {
    lastSrcRef.current = srcDoc;
  }

  return (
    <div ref={containerRef} className={cn("space-y-1.5", className)}>
      {!hideLabel ? (
        <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
          Pré-visualização A4 {orientacao === "landscape" ? "horizontal" : "vertical"}
        </p>
      ) : null}
      <div
        className="mx-auto overflow-hidden rounded-lg border border-slate-600/50 bg-slate-800/40 shadow-inner"
        style={{ maxWidth }}
      >
        <div className="relative w-full bg-white" style={{ aspectRatio: aspect }}>
          {mounted && srcDoc ? (
            <iframe
              key={lastSrcRef.current.slice(0, 64)}
              title={title}
              srcDoc={srcDoc}
              className="absolute inset-0 h-full w-full border-0 bg-white"
              sandbox=""
              referrerPolicy="no-referrer"
              loading="lazy"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-[10px] text-slate-400">
              A carregar pré-visualização…
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export const DocumentPagePreview = memo(DocumentPagePreviewInner);
