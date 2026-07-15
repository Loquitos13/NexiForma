"use client";

import { Check } from "lucide-react";
import {
  BILLING_CATALOG,
  type BillingAddonCode,
  type BillingStandaloneModule,
} from "@nexiforma/shared";
import { ScrollReveal } from "@/components/site/scroll-reveal";
import { cn } from "@/lib/ui/cn";

const MODULE_ACCENT: Partial<Record<BillingAddonCode, string>> = {
  crm: "border-teal-500/30 from-teal-600/10 to-slate-900/50 hover:border-teal-400/40",
  faturacao_at: "border-emerald-500/30 from-emerald-600/10 to-slate-900/50 hover:border-emerald-400/40",
  formacao_core: "border-violet-500/30 from-violet-600/10 to-slate-900/50 hover:border-violet-400/40",
  crm_faturacao: "border-teal-500/30 from-teal-600/10 to-slate-900/50 hover:border-teal-400/40",
  formacao_teams: "border-blue-500/30 from-blue-600/10 to-slate-900/50 hover:border-blue-400/40",
  inteligencia_ia: "border-fuchsia-500/30 from-fuchsia-600/10 to-slate-900/50 hover:border-fuchsia-400/40",
};

type Props = {
  onSelectModule: (module: BillingStandaloneModule) => void;
};

export function StandaloneModulesSection({ onSelectModule }: Props) {
  return (
    <section className="max-w-6xl mx-auto w-full px-5 pb-16">
      <ScrollReveal>
        <div className="text-center mb-8">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-100 mb-2">
            Módulos à la carte
          </h2>
          <p className="text-slate-500 max-w-2xl mx-auto text-sm leading-relaxed">
            {BILLING_CATALOG.policies.standaloneModules}
          </p>
        </div>
      </ScrollReveal>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {BILLING_CATALOG.standaloneModules.map((mod, i) => (
          <ScrollReveal key={mod.code} delay={i * 60}>
            <article
              className={cn(
                "group flex h-full flex-col rounded-xl border bg-gradient-to-b p-5 transition-all duration-300",
                MODULE_ACCENT[mod.code] ??
                  "border-slate-600/30 from-slate-800/10 to-slate-900/50 hover:border-slate-500/40",
              )}
            >
              <h3 className="text-base font-bold text-slate-100">{mod.name}</h3>
              <p className="mt-1 text-xs text-slate-400 leading-relaxed">{mod.tagline}</p>
              <p className="mt-3 text-[11px] text-slate-500 leading-relaxed flex-1">{mod.description}</p>
              <ul className="mt-4 space-y-1.5">
                {mod.highlights.map((h) => (
                  <li key={h} className="flex items-start gap-2 text-[11px] text-slate-300">
                    <Check className="h-3.5 w-3.5 shrink-0 text-teal-400 mt-0.5" aria-hidden />
                    {h}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => onSelectModule(mod)}
                className={cn(
                  "mt-5 w-full rounded-lg py-2 text-xs font-semibold transition-all duration-300",
                  "border border-slate-600/50 text-slate-200 bg-slate-900/40",
                  "opacity-0 translate-y-1 pointer-events-none",
                  "group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto",
                  "group-focus-within:opacity-100 group-focus-within:translate-y-0 group-focus-within:pointer-events-auto",
                  "focus-visible:opacity-100 focus-visible:translate-y-0 focus-visible:pointer-events-auto",
                  "hover:bg-slate-800/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/40",
                )}
              >
                Pedir só este módulo
              </button>
            </article>
          </ScrollReveal>
        ))}
      </div>
    </section>
  );
}
