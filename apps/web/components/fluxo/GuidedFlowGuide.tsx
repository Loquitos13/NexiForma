"use client";

import Link from "next/link";
import { ExternalLink, Lightbulb, MessageCircle } from "lucide-react";
import { askNexiGuia } from "@/lib/client/nexi-guia-events";
import { Alert, Button, Card, CardContent } from "@/components/ui";
import type { GuidedFlowModule } from "./guided-flow-types";

type Props = {
  module: GuidedFlowModule;
};

export function GuidedFlowGuide({ module }: Props) {
  const steps = module.steps ?? [];

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
      <div>
        <h1 className="text-xl font-bold text-slate-50">{module.title}</h1>
        <p className="text-sm text-slate-400 mt-1">{module.description}</p>
        <p className="text-xs text-slate-500 mt-2">
          Cada passo abre a vista real do portal. Usa «Ajuda neste ecrã» para o NexiGuia
          acompanhar-te automaticamente.
        </p>
      </div>

      <ol className="space-y-4">
        {steps.map((step, index) => (
          <li key={`${module.id}-${index}`}>
            <Card className="border-slate-700/40 bg-slate-900/50">
              <CardContent className="p-4 sm:p-5">
                <div className="flex gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-sm font-semibold text-blue-300">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1 space-y-2">
                    <h2 className="text-sm font-semibold text-slate-100">{step.title}</h2>
                    <p className="text-sm text-slate-400 leading-relaxed">{step.description}</p>
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
                          Ajuda neste ecrã
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </li>
        ))}
      </ol>

      <Alert variant="info">
        Segue os passos pela ordem. Só vês fluxos permitidos pelo teu papel e plano. Podes voltar
        a este guia em Fluxo guiado.
      </Alert>
    </div>
  );
}
