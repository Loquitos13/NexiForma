"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useSearchParams } from "next/navigation";
import { Sparkles } from "lucide-react";
import { useActiveGuidedFlow } from "@/lib/client/active-guided-flow-context";
import {
  buildGuidedFlowSearch,
  matchesGuidedFlowHref,
} from "@/lib/client/guided-flow-path";

type AnchorRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

/**
 * Apontador na vista real — só aparece com fluxo guiado activo no passo actual.
 * Nunca mostra balões genéricos fora de um fluxo.
 */
export function GuidedFlowAnchorBubble() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = buildGuidedFlowSearch(searchParams);
  const {
    activeModule,
    currentStep,
    isBubbleOpen,
    isMinimized,
    isCompleted,
  } = useActiveGuidedFlow();
  const [rect, setRect] = useState<AnchorRect | null>(null);

  const anchor = currentStep?.anchor;
  const showAnchor =
    Boolean(activeModule) &&
    Boolean(currentStep) &&
    Boolean(anchor) &&
    !isCompleted &&
    isBubbleOpen &&
    !isMinimized &&
    matchesGuidedFlowHref(pathname, search, currentStep?.href);

  useEffect(() => {
    if (!showAnchor || !anchor) {
      setRect(null);
      return;
    }

    const update = () => {
      const el = document.querySelector(`[data-guided-flow-anchor="${anchor}"]`);
      if (!el) {
        setRect(null);
        return;
      }
      const box = el.getBoundingClientRect();
      setRect({
        top: box.top,
        left: box.left,
        width: box.width,
        height: box.height,
      });
    };

    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [showAnchor, anchor, pathname, search]);

  if (!showAnchor || !rect || !currentStep || typeof document === "undefined") {
    return null;
  }

  const labelTop = Math.max(12, rect.top - 12);

  return createPortal(
    <>
      <div
        className="pointer-events-none fixed z-[125] rounded-lg border-2 border-blue-400/70 bg-blue-500/10 shadow-[0_0_0_9999px_rgba(2,6,23,0.35)] transition-all duration-300"
        style={{
          top: rect.top - 4,
          left: rect.left - 4,
          width: rect.width + 8,
          height: rect.height + 8,
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none fixed z-[126] max-w-[min(16rem,calc(100vw-2rem))] animate-in fade-in slide-in-from-bottom-1 duration-300"
        style={{
          top: labelTop,
          left: rect.left + rect.width / 2,
          transform: "translate(-50%, -100%)",
        }}
      >
        <div className="relative rounded-xl border border-blue-400/45 bg-slate-950/95 px-3 py-2 text-center text-[11px] font-medium leading-snug text-blue-100 shadow-xl shadow-blue-950/60 backdrop-blur-md">
          <Sparkles className="mr-1 inline h-3 w-3 text-blue-400" />
          {currentStep.title}
          <div
            className="absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-b border-r border-blue-400/45 bg-slate-950/95"
            aria-hidden
          />
        </div>
      </div>
    </>,
    document.body,
  );
}
