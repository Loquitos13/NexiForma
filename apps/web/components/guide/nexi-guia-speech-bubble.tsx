"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Compass,
  ExternalLink,
  HelpCircle,
  Lightbulb,
  Minus,
  Sparkles,
  X,
} from "lucide-react";
import { useActiveGuidedFlow } from "@/lib/client/active-guided-flow-context";
import {
  buildGuidedFlowSearch,
  matchesGuidedFlowHref,
} from "@/lib/client/guided-flow-path";
import { askNexiGuia } from "@/lib/client/nexi-guia-events";
import { cn } from "@/lib/ui/cn";

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
    toggleBubble,
    setMinimized,
  } = useActiveGuidedFlow();

  if (!activeModule || !isBubbleOpen) return null;

  const isOnCurrentStepPage = matchesGuidedFlowHref(pathname, search, currentStep?.href);

  if (isMinimized) {
    return (
      <div
        className="fixed z-[130] bottom-24 right-5 animate-in fade-in zoom-in-95 duration-200"
        style={{ transformOrigin: "bottom right" }}
      >
        <button
          type="button"
          onClick={() => setMinimized(false)}
          className="flex items-center gap-2 rounded-full border border-blue-500/40 bg-slate-950/90 px-3.5 py-1.5 text-xs font-medium text-blue-200 shadow-xl shadow-blue-950/40 backdrop-blur-md hover:bg-slate-900 transition-all"
          title="Expandir guia do NexiGuia"
        >
          <Sparkles className="h-3.5 w-3.5 text-blue-400 animate-pulse" />
          <span>
            {activeModule.title}: Passo {currentStepIndex + 1}/{totalSteps}
          </span>
        </button>
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-label="Guia do NexiGuia"
      className="fixed z-[130] bottom-24 right-5 w-[min(calc(100vw-2.5rem),23rem)] select-none animate-in fade-in zoom-in-90 duration-300 transition-all"
      style={{
        transformOrigin: "bottom right",
      }}
    >
      {/* Speech balloon container */}
      <div className="relative rounded-2xl border border-blue-500/35 bg-slate-950/95 p-4 text-slate-200 shadow-2xl shadow-black/80 backdrop-blur-xl ring-1 ring-blue-500/20">
        {/* Balloon pointer tail pointing to the bottom right FAB */}
        <div
          className="absolute -bottom-2.5 right-6 h-4 w-4 rotate-45 border-b border-r border-blue-500/35 bg-slate-950/95"
          aria-hidden="true"
        />

        {/* Header */}
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
              onClick={() => setMinimized(true)}
              className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
              title="Minimizar balão"
              aria-label="Minimizar"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={closeFlow}
              className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
              title="Fechar fluxo guiado"
              aria-label="Fechar"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Main Content with transition animation on step change */}
        <div
          key={`${activeModule.id}-${currentStepIndex}-${isCompleted}`}
          className="mt-3 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-200"
        >
          {/* Supportive Comfort Message */}
          <div className="rounded-xl border border-blue-500/20 bg-gradient-to-r from-blue-950/40 via-slate-900/60 to-teal-950/30 p-3">
            <div className="flex items-start gap-2.5">
              <Sparkles className="h-4 w-4 shrink-0 text-blue-400 mt-0.5" />
              <div className="text-xs leading-relaxed text-blue-100/90 font-medium">
                {supportiveMessage?.comfort}
              </div>
            </div>
          </div>

          {!isCompleted && currentStep ? (
            /* Current Step Guide */
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

              {/* Navigation to step page button */}
              {currentStep.href ? (
                <div className="pt-1">
                  {!isOnCurrentStepPage ? (
                    <button
                      type="button"
                      onClick={() => router.push(currentStep.href!)}
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

          {isCompleted ? (
            /* Completed Flow Celebration */
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/30 p-3.5 text-center space-y-2">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300">
                <CheckCircle2 className="h-6 w-6 text-emerald-400" />
              </div>
              <p className="text-xs font-semibold text-emerald-200">
                Fluxo concluído com distinção!
              </p>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Excelente trabalho! Concluíste todas as tarefas necessárias para esta operação.
              </p>
              <button
                type="button"
                onClick={closeFlow}
                className="mt-1 w-full rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors"
              >
                Concluir e fechar guia
              </button>
            </div>
          ) : null}
        </div>

        {/* Footer Navigation Controls */}
        {!isCompleted ? (
          <div className="mt-3.5 flex items-center justify-between gap-2 border-t border-slate-800/80 pt-3">
            {/* Step indicators */}
            <div className="flex items-center gap-1">
              {Array.from({ length: totalSteps }).map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => goToStep(idx)}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
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
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900/80 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors"
                  title="Passo anterior"
                >
                  <ArrowLeft className="h-3 w-3" />
                  <span>Anterior</span>
                </button>
              ) : null}

              <button
                type="button"
                onClick={nextStep}
                className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1 text-xs font-semibold text-white shadow-sm hover:bg-blue-500 transition-colors"
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
