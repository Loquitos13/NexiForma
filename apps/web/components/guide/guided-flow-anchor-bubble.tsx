"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useSearchParams } from "next/navigation";
import { Sparkles } from "lucide-react";
import { useActiveGuidedFlow } from "@/lib/client/active-guided-flow-context";
import {
  buildGuidedFlowSearch,
  guidedFlowStepHrefOptions,
  isGuidedFlowStepComplete,
  matchesGuidedFlowHref,
  resolveGuidedFlowAnchorElement,
} from "@/lib/client/guided-flow-path";
import { cn } from "@/lib/ui/cn";

type AnchorRect = {
  top: number;
  left: number;
  width: number;
  height: number;
  borderRadius: string;
};

/**
 * Apontador na vista real - só aparece com fluxo guiado activo no passo actual.
 * Com modal aberto, o foco passa para o alvo dentro do modal (nunca escurece o modal).
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
  const [insideModal, setInsideModal] = useState(false);

  const anchor = currentStep?.anchor;
  const showAnchor =
    Boolean(activeModule) &&
    Boolean(currentStep) &&
    Boolean(anchor) &&
    !isCompleted &&
    isBubbleOpen &&
    !isMinimized &&
    matchesGuidedFlowHref(
      pathname,
      search,
      currentStep?.anchorHref ?? currentStep?.href,
      guidedFlowStepHrefOptions(currentStep),
    );

  useEffect(() => {
    if (!showAnchor || !anchor) {
      setRect(null);
      setInsideModal(false);
      return;
    }

    const update = () => {
      const { element, insideModal: inModal } = resolveGuidedFlowAnchorElement(anchor);
      if (!element) {
        setRect(null);
        setInsideModal(false);
        return;
      }
      const box = element.getBoundingClientRect();
      const computed = window.getComputedStyle(element);
      setInsideModal(inModal);
      setRect({
        top: box.top,
        left: box.left,
        width: box.width,
        height: box.height,
        borderRadius: computed.borderRadius || "0.5rem",
      });
    };

    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    const mo = new MutationObserver(update);
    mo.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["data-state", "open", "style", "class"],
    });
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
      mo.disconnect();
    };
  }, [showAnchor, anchor, pathname, search]);

  if (!showAnchor || !rect || !currentStep || typeof document === "undefined") {
    return null;
  }

  const labelTop = Math.max(12, rect.top - 12);
  const spotlightZ = insideModal ? "z-[55]" : "z-[125]";
  const labelZ = insideModal ? "z-[56]" : "z-[126]";
  const pad = 6;
  const frameStyle = {
    top: rect.top - pad,
    left: rect.left - pad,
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
    borderRadius: rect.borderRadius,
  } as const;

  return createPortal(
    <>
      <div
        className={cn("guided-flow-spotlight pointer-events-none fixed", spotlightZ)}
        style={frameStyle}
        aria-hidden
      >
        <div className="guided-flow-spotlight__mask">
          <div className="guided-flow-spotlight__rgb" />
          <div
            className="guided-flow-spotlight__inner"
            style={{ borderRadius: rect.borderRadius }}
          />
        </div>
        <div className="guided-flow-spotlight__pulse" />
      </div>
      <div
        className={cn(
          "pointer-events-none fixed max-w-[min(16rem,calc(100vw-2rem))] animate-in fade-in slide-in-from-bottom-1 duration-300",
          labelZ,
        )}
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
