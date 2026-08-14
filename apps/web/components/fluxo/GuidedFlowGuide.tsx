"use client";

import Link from "next/link";
import {
  Compass,
  ExternalLink,
  Lightbulb,
  MessageCircle,
  Play,
  Sparkles,
  StopCircle,
} from "lucide-react";
import { askNexiGuia } from "@/lib/client/nexi-guia-events";
import { useAutoStartGuidedFlow } from "@/lib/client/use-auto-start-guided-flow";
import { useActiveGuidedFlow } from "@/lib/client/active-guided-flow-context";
import { Alert, Button, Card, CardContent } from "@/components/ui";
import type { GuidedFlowModule } from "./guided-flow-types";

type Props = {
  module: GuidedFlowModule;
};

export function GuidedFlowGuide({ module }: Props) {
  const steps = module.steps ?? [];
  const { activeModule, currentStepIndex, startFlow, closeFlow } = useActiveGuidedFlow();
  useAutoStartGuidedFlow(module.id, 0);

  const isCurrentModuleActive = activeModule?.id === module.id;

  if (steps.length === 0) {
    return (
      <div className="p-6 max-w-2xl space-y-4">
        <p className="text-sm text-slate-400">{module.description}</p>
        {module.href ? (
          <Link href={module.href}>
            <Button size="sm">Abrir módulo</Button>
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl space-y-6">
      {/* Header and Hero Start with NexiGuia */}
      <div className="rounded-2xl border border-blue-500/25 bg-gradient-to-b from-blue-950/40 via-slate-900/60 to-slate-950/80 p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-blue-300">
                <Sparkles className="h-3 w-3" /> Modo Guiado
              </span>
            </div>
            <h1 className="text-xl font-bold text-slate-50">{module.title}</h1>
            <p className="text-sm text-slate-300 leading-relaxed">{module.description}</p>
          </div>

          <div className="shrink-0 flex items-center gap-2">
            {isCurrentModuleActive ? (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-950/40 px-3 py-2 text-xs font-semibold text-emerald-200">
                  <Compass className="h-4 w-4 animate-spin-slow text-emerald-400" />
                  Passo {currentStepIndex + 1} de {steps.length}
                </span>
                <button
                  type="button"
                  onClick={closeFlow}
                  className="rounded-lg border border-slate-700 bg-slate-900/80 px-2.5 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                  title="Parar guia ativo"
                >
                  <StopCircle className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => startFlow(module, 0)}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-teal-500 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-900/40 hover:from-blue-500 hover:to-teal-400 hover:shadow-blue-800/60 transition-all active:scale-[0.98]"
              >
                <Compass className="h-4 w-4" />
                <span>Iniciar fluxo com o NexiGuia</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Step by Step list */}
      <ol className="space-y-4">
        {steps.map((step, index) => {
          const isStepActive = isCurrentModuleActive && currentStepIndex === index;
          return (
            <li key={`${module.id}-${index}`}>
              <Card
                className={
                  isStepActive
                    ? "border-blue-500/60 bg-slate-900/90 shadow-lg shadow-blue-950/30 ring-1 ring-blue-500/30"
                    : "border-slate-700/40 bg-slate-900/50"
                }
              >
                <CardContent className="p-4 sm:p-5">
                  <div className="flex gap-3">
                    <span
                      className={
                        isStepActive
                          ? "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500 text-sm font-bold text-white shadow-md shadow-blue-600/40 animate-pulse"
                          : "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-sm font-semibold text-blue-300"
                      }
                    >
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <h2 className="text-sm font-semibold text-slate-100">{step.title}</h2>
                        <button
                          type="button"
                          onClick={() => startFlow(module, index)}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          <Play className="h-3 w-3" />
                          <span>{isStepActive ? "Em progresso" : "Guiar a partir daqui"}</span>
                        </button>
                      </div>

                      <p className="text-sm text-slate-400 leading-relaxed">
                        {step.description}
                      </p>

                      {step.tip ? (
                        <p className="flex gap-2 text-xs text-amber-200/90 bg-amber-950/30 border border-amber-500/20 rounded-lg px-3 py-2">
                          <Lightbulb className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                          <span>{step.tip}</span>
                        </p>
                      ) : null}

                      <div className="flex flex-wrap items-center gap-3 pt-1">
                        {step.href ? (
                          <Link
                            href={step.href}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-400 hover:text-blue-300"
                          >
                            Ir à vista real
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        ) : null}
                        {step.helpPrompt || step.href ? (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-400 hover:text-teal-300"
                            onClick={() => {
                              const prompt =
                                step.helpPrompt ||
                                `Ajuda-me neste passo do fluxo «${module.title}»: ${step.title}. ${step.description}`;
                              askNexiGuia(prompt);
                            }}
                          >
                            <MessageCircle className="h-3 w-3" />
                            Ajuda no chat
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ol>

      <Alert variant="info">
        O NexiGuia acompanha-te de forma interativa através do balão de fala dinâmico. Podes
        avançar ou retroceder passos a qualquer momento.
      </Alert>
    </div>
  );
}
