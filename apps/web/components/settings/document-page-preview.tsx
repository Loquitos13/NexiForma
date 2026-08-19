"use client";

import { memo, useEffect, useRef, useState } from "react";
import type { DocumentOrientacao } from "@nexiforma/shared";
import { cn } from "@/lib/ui/cn";
import { useA4PageScale } from "@/lib/ui/use-a4-page-scale";

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
  const [mounted, setMounted] = useState(!lazy);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageWrapRef = useRef<HTMLDivElement>(null);
  const { scale, pageWidthPx, pageHeightPx } = useA4PageScale(pageWrapRef, orientacao);
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
  const iframeKey = srcDoc ? `${srcDoc.length}:${srcDoc.slice(-40)}` : "empty";

  return (
    <div ref={containerRef} className={cn("space-y-1.5", className)}>
      {!hideLabel ? (
        <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
          Pré-visualização A4 {orientacao === "landscape" ? "horizontal" : "vertical"}
        </p>
      ) : null}
      <div
        ref={pageWrapRef}
        className="mx-auto w-full overflow-hidden rounded-lg border border-slate-600/50 bg-slate-800/40 shadow-inner"
        style={{ maxWidth }}
      >
        <div
          className="relative mx-auto overflow-hidden bg-white"
          style={{
            width: pageWidthPx * scale,
            height: pageHeightPx * scale,
          }}
        >
          {mounted && srcDoc ? (
            <iframe
              key={iframeKey}
              title={title}
              srcDoc={srcDoc}
              className="pointer-events-none absolute left-0 top-0 border-0 bg-white"
              style={{
                width: pageWidthPx,
                height: pageHeightPx,
                transform: `scale(${scale})`,
                transformOrigin: "top left",
              }}
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
