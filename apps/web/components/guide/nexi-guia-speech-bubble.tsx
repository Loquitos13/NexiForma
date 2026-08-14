"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Compass,
  ExternalLink,
  Lightbulb,
  Minus,
  Sparkles,
  X,
} from "lucide-react";
import { useActiveGuidedFlow } from "@/lib/client/active-guided-flow-context";
import {
  buildGuidedFlowSearch,
  isGuidedFlowStepComplete,
  resolveGuidedFlowAnchorElement,
  resolveGuidedFlowNavigationHref,
} from "@/lib/client/guided-flow-path";
import { cn } from "@/lib/ui/cn";

/** Tempo total do pop-in (balão + lâmpada regressam ao FAB). */
const BUBBLE_EXIT_MS = 500;
const MINIMIZED_EXIT_MS = 300;

type ExitPhase = "minimize" | "close" | null;

type BubbleCorner = "right" | "left";

export function NexiGuiaSpeechBubble() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = buildGuidedFlowSearch(searchParams);
  const {
    activeModule,
    currentStepIndex,
    currentStep,
    totalSteps,
    isCompleted,
    isBubbleOpen,
    isMinimized,
    supportiveMessage,
    nextStep,
    prevStep,
    goToStep,
    closeFlow,
    completeFlow,
    setMinimized,
  } = useActiveGuidedFlow();

  const [exitPhase, setExitPhase] = useState<ExitPhase>(null);
  const [minimizedExiting, setMinimizedExiting] = useState(false);
  const [bubbleCorner, setBubbleCorner] = useState<BubbleCorner>("right");
  const exitTimerRef = useRef<number | null>(null);

  const clearExitTimer = () => {
    if (exitTimerRef.current != null) {
      window.clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }
  };

  useEffect(() => () => clearExitTimer(), []);

  useEffect(() => {
    if (isMinimized) setMinimizedExiting(false);
  }, [isMinimized]);

  useEffect(() => {
    const anchor = currentStep?.anchor;
    if (!anchor || !isBubbleOpen || isMinimized || isCompleted) {
      setBubbleCorner("right");
      return;
    }

    const update = () => {
      const { element } = resolveGuidedFlowAnchorElement(anchor);
      // Com spotlight activo, deslocar o balão para a esquerda para não tapar o alvo.
      setBubbleCorner(element ? "left" : "right");
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    const mo = new MutationObserver(update);
    mo.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["class", "style", "data-state"],
    });
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      mo.disconnect();
    };
  }, [currentStep?.anchor, isBubbleOpen, isMinimized, isCompleted]);

  const beginMinimize = () => {
    if (exitPhase) return;
    setExitPhase("minimize");
    clearExitTimer();
    exitTimerRef.current = window.setTimeout(() => {
      setMinimized(true);
      setExitPhase(null);
    }, BUBBLE_EXIT_MS);
  };

  const beginClose = () => {
    if (exitPhase) return;
    setExitPhase("close");
    clearExitTimer();
    exitTimerRef.current = window.setTimeout(() => {
      closeFlow();
      setExitPhase(null);
    }, BUBBLE_EXIT_MS);
  };

  const beginExpand = () => {
    if (minimizedExiting) return;
    setMinimizedExiting(true);
    clearExitTimer();
    exitTimerRef.current = window.setTimeout(() => {
      setMinimized(false);
      setMinimizedExiting(false);
    }, MINIMIZED_EXIT_MS);
  };

  if (!activeModule || !isBubbleOpen) return null;

  const isOnCurrentStepPage = isGuidedFlowStepComplete(pathname, search, currentStep);
  const isExiting = exitPhase !== null;
  const bubbleSideClass =
    bubbleCorner === "left" ? "nexiguia-speech-anchor--left" : undefined;

  if (isMinimized && !isExiting) {
    return (
      <div
        className={cn(
          "fixed z-[130] nexiguia-speech-anchor",
          bubbleSideClass,
          minimizedExiting ? "nexiguia-minimized-pop-in" : "nexiguia-minimized-pop",
        )}
        style={{ transformOrigin: bubbleCorner === "left" ? "bottom left" : "bottom right" }}
      >
        <button
          type="button"
          onClick={beginExpand}
          className="flex items-center gap-2 rounded-full border border-blue-500/40 bg-slate-950/90 px-3.5 py-1.5 text-xs font-medium text-blue-200 shadow-xl shadow-blue-950/40 backdrop-blur-md hover:bg-slate-900 transition-colors"
          title="Expandir guia do NexiGuia"
        >
          <Sparkles className="h-3.5 w-3.5 text-blue-400 animate-pulse" />
          <span>
            {isCompleted
              ? `${activeModule.title}: concluído`
              : `${activeModule.title}: Passo ${currentStepIndex + 1}/${totalSteps}`}
          </span>
        </button>
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-label="Guia do NexiGuia"
      className={cn(
        "fixed z-[130] nexiguia-speech-anchor w-[min(calc(100vw-2.5rem),23rem)] select-none transition-[left,right] duration-300",
        bubbleSideClass,
      )}
      aria-hidden={isExiting}
    >
      <div
        className={cn(
          "pointer-events-none absolute -bottom-1 flex h-10 w-10 items-center justify-center",
          bubbleCorner === "left" ? "left-0" : "right-0",
          isExiting ? "nexiguia-idea-pop-in" : "nexiguia-idea-pop",
        )}
      >
        <span
          className={cn(
            "absolute inset-0 rounded-full bg-blue-400/25",
            isExiting ? "nexiguia-idea-ring-in" : "nexiguia-idea-ring",
          )}
          aria-hidden
        />
        <Lightbulb className="relative h-5 w-5 text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.85)]" />
      </div>

      <div
        className={cn(
          "relative mb-14 rounded-2xl border border-blue-500/35 bg-slate-950/95 p-4 text-slate-200 shadow-2xl shadow-black/80 backdrop-blur-xl ring-1 ring-blue-500/20",
          bubbleCorner === "left" ? "ml-1" : "mr-1",
          isExiting ? "nexiguia-speech-pop-in pointer-events-none" : "nexiguia-speech-pop",
          bubbleCorner === "left" && "nexiguia-speech-panel--left",
        )}
      >
        <div
          className={cn(
            "absolute -bottom-2.5 h-4 w-4 rotate-45 border-b border-r border-blue-500/35 bg-slate-950/95",
            bubbleCorner === "left" ? "left-6" : "right-6",
          )}
          aria-hidden="true"
        />

        <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-blue-600 to-teal-400 text-white shadow-sm">
              <Compass className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400">
                  NexiGuia
                </span>
                <span className="text-[10px] text-slate-500">·</span>
                <span className="truncate text-[11px] font-medium text-slate-300">
                  {activeModule.title}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={beginMinimize}
              disabled={isExiting}
              className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors disabled:opacity-40"
              title="Minimizar balão"
              aria-label="Minimizar"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={beginClose}
              disabled={isExiting}
              className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors disabled:opacity-40"
              title="Fechar fluxo guiado"
              aria-label="Fechar"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div
          key={`${activeModule.id}-${currentStepIndex}-${isCompleted}`}
          className="mt-3 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-200"
        >
          {isCompleted ? (
            <div className="rounded-xl border border-emerald-500/35 bg-gradient-to-b from-emerald-950/50 to-slate-950/80 p-4 text-center space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300 ring-2 ring-emerald-500/30">
                <CheckCircle2 className="h-7 w-7 text-emerald-400" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-emerald-200">
                  {supportiveMessage?.headline ?? "Missão cumprida com sucesso!"}
                </p>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {supportiveMessage?.comfort}
                </p>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed border-t border-emerald-500/20 pt-3">
                {supportiveMessage?.actionGuide}
              </p>
              <button
                type="button"
                onClick={beginClose}
                disabled={isExiting}
                className="w-full rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow hover:bg-emerald-500 transition-colors disabled:opacity-40"
              >
                Concluir e fechar guia
              </button>
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-blue-500/20 bg-gradient-to-r from-blue-950/40 via-slate-900/60 to-teal-950/30 p-3">
                <div className="flex items-start gap-2.5">
                  <Sparkles className="h-4 w-4 shrink-0 text-blue-400 mt-0.5" />
                  <div className="text-xs leading-relaxed text-blue-100/90 font-medium">
                    {supportiveMessage?.comfort}
                  </div>
                </div>
              </div>

              {currentStep ? (
                <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-semibold text-blue-300">
                      Passo {currentStepIndex + 1} de {totalSteps}
                    </span>
                    <span className="text-xs font-semibold text-slate-100 truncate">
                      {currentStep.title}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">
                    {currentStep.description}
                  </p>

                  {currentStep.tip ? (
                    <div className="flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-950/30 px-2.5 py-1.5 text-[11px] text-amber-200/90">
                      <Lightbulb className="h-3.5 w-3.5 shrink-0 text-amber-400 mt-0.5" />
                      <span className="leading-snug">{currentStep.tip}</span>
                    </div>
                  ) : null}

                  {currentStep.href ? (
                    <div className="pt-1">
                      {!isOnCurrentStepPage ? (
                        <button
                          type="button"
                          onClick={() =>
                            router.push(
                              resolveGuidedFlowNavigationHref(pathname, currentStep.href!),
                            )
                          }
                          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-blue-600/90 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-blue-500 transition-colors"
                        >
                          <span>Ir para esta vista</span>
                          <ExternalLink className="h-3.5 w-3.5" />
                        </button>
                      ) : (
                        <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Estás no ecrã correto deste passo</span>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </>
          )}
        </div>

        {!isCompleted ? (
          <div className="mt-3.5 flex items-center justify-between gap-2 border-t border-slate-800/80 pt-3">
            <div className="flex items-center gap-1">
              {Array.from({ length: totalSteps }).map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => goToStep(idx)}
                  disabled={isExiting}
                  className={cn(
                    "h-1.5 rounded-full transition-all disabled:opacity-40",
                    idx === currentStepIndex
                      ? "w-5 bg-blue-400"
                      : idx < currentStepIndex
                        ? "w-2 bg-emerald-500"
                        : "w-2 bg-slate-700 hover:bg-slate-600",
                  )}
                  title={`Ir para passo ${idx + 1}`}
                  aria-label={`Passo ${idx + 1}`}
                />
              ))}
            </div>

            <div className="flex items-center gap-1.5">
              {currentStepIndex > 0 ? (
                <button
                  type="button"
                  onClick={prevStep}
                  disabled={isExiting}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900/80 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors disabled:opacity-40"
                  title="Passo anterior"
                >
                  <ArrowLeft className="h-3 w-3" />
                  <span>Anterior</span>
                </button>
              ) : null}

              <button
                type="button"
                onClick={() => {
                  if (currentStepIndex >= totalSteps - 1) {
                    completeFlow();
                    return;
                  }
                  nextStep();
                }}
                disabled={isExiting}
                className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1 text-xs font-semibold text-white shadow-sm hover:bg-blue-500 transition-colors disabled:opacity-40"
              >
                <span>
                  {currentStepIndex === totalSteps - 1 ? "Concluir" : "Seguinte"}
                </span>
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
