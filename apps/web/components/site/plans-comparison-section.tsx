"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Check, Minus, Plus, Sparkles } from "lucide-react";
import {
  BILLING_CATALOG,
  BILLING_CORE_PLAN_CODES,
  type BillingAddonCode,
  type BillingCorePlanCode,
  type BillingPlanCode,
  type BillingStandaloneModule,
  type PlanFeatureCell,
} from "@nexiforma/shared";
import { ScrollReveal } from "@/components/site/scroll-reveal";
import { SalesContactDialog } from "@/components/site/sales-contact-dialog";
import { StandaloneModulesSection } from "@/components/site/standalone-modules-section";
import { cn } from "@/lib/ui/cn";

const CATEGORY_LABELS: Record<string, string> = {
  core: "Assinatura Core",
  module: "Módulos",
  reports: "Relatórios",
  commercial: "Flexibilidade comercial",
};

const CORE_PLANS = BILLING_CATALOG.plans.filter((plan): plan is (typeof BILLING_CATALOG.plans)[number] & {
  code: BillingCorePlanCode;
} => (BILLING_CORE_PLAN_CODES as readonly string[]).includes(plan.code));

const PLAN_ACCENT = {
  starter: {
    header: "text-blue-300",
    badge: "border-blue-400/50 text-blue-200 shadow-blue-500/30 bg-slate-950/90",
    cardActive: "border-blue-400/60 ring-1 ring-blue-400/30",
    exploreActive: "border-blue-400/60 bg-blue-500/20 shadow-blue-500/25",
    status: "text-blue-300",
    cardDefault: "border-slate-700/35 bg-slate-900/40",
  },
  pro: {
    header: "text-fuchsia-300",
    badge:
      "border-fuchsia-400/55 text-fuchsia-100 shadow-[0_0_18px_rgba(232,121,249,0.35)] bg-slate-950/90",
    cardActive: "border-fuchsia-400/60 ring-1 ring-fuchsia-400/35",
    exploreActive:
      "border-fuchsia-400/60 bg-fuchsia-500/15 shadow-[0_0_20px_rgba(255,71,171,0.25)]",
    status: "text-fuchsia-300",
    cardDefault:
      "border-fuchsia-500/30 bg-gradient-to-b from-fuchsia-600/10 via-purple-900/10 to-slate-900/50",
  },
  enterprise: {
    header: "text-amber-300",
    badge:
      "border-amber-400/60 text-amber-100 shadow-[0_0_22px_rgba(251,191,36,0.45)] bg-slate-950/90",
    cardActive: "border-amber-400/65 ring-1 ring-amber-400/40",
    exploreActive:
      "border-amber-400/65 bg-amber-500/15 shadow-[0_0_24px_rgba(251,191,36,0.35)]",
    status: "text-amber-300",
    cardDefault: "border-slate-700/35 bg-slate-900/40",
  },
} as const satisfies Record<
  BillingCorePlanCode,
  {
    header: string;
    badge: string;
    cardActive: string;
    exploreActive: string;
    status: string;
    cardDefault: string;
  }
>;

function featureStatusText(cell: PlanFeatureCell): string {
  if (cell.kind === "unavailable") return "Não disponível";
  if (cell.kind === "included") return "Incluído";
  if (cell.kind === "native") return cell.hint ?? "Incluído nativamente";
  if (cell.kind === "addon") return cell.hint ?? "Add-on disponível";
  return cell.text;
}

function featureStatusClass(cell: PlanFeatureCell): string {
  if (cell.kind === "unavailable") return "text-slate-600";
  if (cell.kind === "included") return "text-teal-300";
  if (cell.kind === "native") return "text-blue-300";
  if (cell.kind === "addon") return "text-amber-300";
  return "text-slate-300";
}

function SelectedPlanFeatures({
  planCode,
  rowsByCategory,
  onClear,
  onContact,
}: {
  planCode: BillingCorePlanCode;
  rowsByCategory: Map<string, typeof BILLING_CATALOG.comparisonRows>;
  onClear: () => void;
  onContact: () => void;
}) {
  const plan = CORE_PLANS.find((p) => p.code === planCode);
  const accent = PLAN_ACCENT[planCode];
  if (!plan) return null;

  const includedCount = BILLING_CATALOG.comparisonRows.filter((row) => {
    const cell = row.values[planCode];
    return cell.kind === "included" || cell.kind === "native";
  }).length;

  return (
    <div className={cn("overflow-hidden rounded-xl border bg-slate-900/35", accent.cardActive)}>
      <div className="flex items-start justify-between gap-3 border-b border-slate-700/40 bg-slate-950/50 px-4 py-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Plano seleccionado</p>
          <h3 className={cn("truncate text-base font-bold", accent.header)}>{plan.name}</h3>
          <p className="mt-1 text-[11px] leading-snug text-slate-500">{plan.tagline}</p>
          <p className="mt-1.5 text-[10px] text-slate-600">
            {includedCount} funcionalidades incluídas · lista completa abaixo
          </p>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="shrink-0 rounded-lg border border-slate-600/50 px-2.5 py-1.5 text-[11px] font-medium text-slate-300 hover:bg-slate-800/60"
        >
          Comparar todos
        </button>
      </div>

      <div className="max-h-[min(70dvh,36rem)] overflow-y-auto">
        {[...rowsByCategory.entries()].map(([category, rows]) => (
          <div key={category}>
            <p className="bg-slate-950/30 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
              {CATEGORY_LABELS[category] ?? category}
            </p>
            <ul>
              {rows.map((row) => {
                const cell = row.values[planCode];
                const status = featureStatusText(cell);
                const unavailable = cell.kind === "unavailable";
                return (
                  <li
                    key={row.id}
                    className={cn(
                      "flex items-start justify-between gap-3 border-t border-slate-800/50 px-4 py-3",
                      unavailable && "opacity-70",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "text-[11px] font-medium leading-snug",
                          unavailable ? "text-slate-500" : "text-slate-200",
                        )}
                      >
                        {row.label}
                      </p>
                      {row.description ? (
                        <p className="mt-0.5 text-[10px] leading-snug text-slate-500">{row.description}</p>
                      ) : null}
                    </div>
                    <span
                      className={cn(
                        "shrink-0 max-w-[44%] text-right text-[10px] font-semibold leading-snug",
                        featureStatusClass(cell),
                      )}
                    >
                      {status}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-slate-700/35 bg-slate-950/25 p-3">
        <button
          type="button"
          onClick={onContact}
          className={cn(
            "w-full rounded-lg py-2.5 text-xs font-semibold text-white transition-all",
            planCode === "starter" && "bg-gradient-to-r from-blue-600 to-blue-700",
            planCode === "pro" && "bg-gradient-to-r from-fuchsia-600 to-purple-600",
            planCode === "enterprise" && "bg-gradient-to-r from-amber-500 to-orange-600",
          )}
        >
          Pedir proposta - {plan.name}
        </button>
      </div>
    </div>
  );
}

function FeatureCell({ cell }: { cell: PlanFeatureCell }) {
  const iconClass = "h-3.5 w-3.5 shrink-0";

  if (cell.kind === "included") {
    return (
      <span className="inline-flex items-center justify-center text-teal-300">
        <Check className={iconClass} aria-hidden />
        <span className="sr-only">Incluído</span>
      </span>
    );
  }
  if (cell.kind === "native") {
    return (
      <span
        className="inline-flex flex-col items-center justify-center gap-0.5"
        title={cell.hint ?? "Incluído nativamente"}
      >
        <Check className={cn(iconClass, "text-blue-300")} aria-hidden />
        <span className="text-[9px] leading-tight text-blue-300/90">{cell.hint ?? "Nativo"}</span>
      </span>
    );
  }
  if (cell.kind === "addon") {
    return (
      <span
        className="inline-flex flex-col items-center justify-center gap-0.5"
        title={cell.hint ?? "Add-on disponível"}
      >
        <Plus className={cn(iconClass, "text-amber-300")} aria-hidden />
        <span className="text-[9px] leading-tight text-amber-200/90">{cell.hint ?? "Add-on"}</span>
      </span>
    );
  }
  if (cell.kind === "unavailable") {
    return (
      <span className="inline-flex items-center justify-center text-slate-600">
        <Minus className={iconClass} aria-hidden />
        <span className="sr-only">Não disponível</span>
      </span>
    );
  }
  return (
    <span className="block max-w-[9rem] mx-auto text-center text-[10px] leading-snug text-slate-300 line-clamp-3">
      {cell.text}
    </span>
  );
}

export function PlansComparisonSection() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<BillingPlanCode | "custom" | "modules_only" | undefined>();
  const [defaultAddons, setDefaultAddons] = useState<BillingAddonCode[]>([]);
  const [exploringPlan, setExploringPlan] = useState<BillingCorePlanCode | null>(null);
  const featuresRef = useRef<HTMLDivElement>(null);

  const rowsByCategory = useMemo(() => {
    const groups = new Map<string, typeof BILLING_CATALOG.comparisonRows>();
    for (const row of BILLING_CATALOG.comparisonRows) {
      const list = groups.get(row.category) ?? [];
      list.push(row);
      groups.set(row.category, list);
    }
    return groups;
  }, []);

  useEffect(() => {
    if (!exploringPlan) return;
    featuresRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [exploringPlan]);

  const openContact = (plan?: BillingPlanCode | "custom" | "modules_only", addons: BillingAddonCode[] = []) => {
    setSelectedPlan(plan);
    setDefaultAddons(addons);
    setDialogOpen(true);
  };

  const explorePlan = (planCode: BillingCorePlanCode) => {
    setExploringPlan((prev) => (prev === planCode ? null : planCode));
  };

  const openStandaloneModule = (mod: BillingStandaloneModule) => {
    openContact("modules_only", [mod.code]);
  };

  return (
    <>
      <section id="planos" className="max-w-6xl mx-auto w-full px-5 pb-20 scroll-mt-20">
        <ScrollReveal>
          <div className="text-center mb-8">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/10 border border-purple-500/25 text-purple-300 mb-3">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              Core, módulos ou ambos
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-100 mb-2">
              {BILLING_CATALOG.headline}
            </h2>
            <p className="text-slate-500 max-w-2xl mx-auto text-sm leading-relaxed">
              {BILLING_CATALOG.subheadline}
            </p>
          </div>
        </ScrollReveal>

        <div className="grid md:grid-cols-3 gap-3 mb-6">
          {CORE_PLANS.map((plan, i) => {
            const accent = PLAN_ACCENT[plan.code];
            const isExploring = exploringPlan === plan.code;
            return (
              <ScrollReveal key={plan.code} delay={i * 70}>
                <div
                  className={cn(
                    "group relative flex h-full flex-col rounded-xl border p-4 transition-all duration-300",
                    isExploring ? accent.cardActive : accent.cardDefault,
                  )}
                >
                  {plan.highlighted ? (
                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-fuchsia-600 to-purple-600 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white shadow-[0_0_14px_rgba(232,121,249,0.35)]">
                      Recomendado
                    </span>
                  ) : null}
                  <h3 className="text-base font-bold text-slate-100">{plan.name}</h3>
                  <p className="mt-1 flex-1 text-xs text-slate-500 leading-relaxed">{plan.tagline}</p>
                  <button
                    type="button"
                    onClick={() => explorePlan(plan.code)}
                    aria-label={`Explorar plano ${plan.name}`}
                    aria-pressed={isExploring}
                    className={cn(
                      "mt-3 w-full rounded-lg py-2 text-xs font-semibold transition-all duration-300",
                      "border text-slate-200",
                      plan.code === "starter" &&
                        "border-blue-500/35 text-blue-200 bg-blue-500/10 hover:bg-blue-500/20",
                      plan.code === "pro" &&
                        "border-fuchsia-500/35 text-fuchsia-200 bg-fuchsia-500/10 hover:bg-fuchsia-500/20",
                      plan.code === "enterprise" &&
                        "border-amber-500/35 text-amber-200 bg-amber-500/10 hover:bg-amber-500/20",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/50",
                      isExploring
                        ? cn("opacity-100", accent.exploreActive)
                        : "opacity-100 hover:brightness-110",
                    )}
                  >
                    {isExploring ? "A ver funcionalidades" : "Ver funcionalidades"}
                  </button>
                </div>
              </ScrollReveal>
            );
          })}
        </div>

        <div ref={featuresRef}>
          {exploringPlan ? (
            <SelectedPlanFeatures
              planCode={exploringPlan}
              rowsByCategory={rowsByCategory}
              onClear={() => setExploringPlan(null)}
              onContact={() => openContact(exploringPlan)}
            />
          ) : (
            <>
              <p className="mb-3 rounded-xl border border-dashed border-slate-700/40 bg-slate-900/25 px-4 py-5 text-center text-xs leading-relaxed text-slate-500 lg:hidden">
                Toque em <span className="font-semibold text-slate-400">Explorar</span> num plano para ver
                todas as funcionalidades desse plano numa lista simples.
              </p>

              <div className="hidden lg:block rounded-xl border border-slate-700/35 bg-slate-900/35 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full table-fixed border-collapse text-xs">
                    <colgroup>
                      <col className="w-[34%]" />
                      <col className="w-[22%]" />
                      <col className="w-[22%]" />
                      <col className="w-[22%]" />
                    </colgroup>
                    <thead>
                      <tr className="border-b border-slate-700/40 bg-slate-950/50">
                        <th className="py-2.5 pl-4 pr-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                          Funcionalidade
                        </th>
                        {CORE_PLANS.map((p) => (
                          <th
                            key={p.code}
                            className={cn(
                              "px-2 py-2.5 text-center align-middle text-xs font-bold text-slate-200",
                              p.code === "pro" && "text-fuchsia-300/90",
                            )}
                          >
                            {p.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[...rowsByCategory.entries()].map(([category, rows]) => (
                        <Fragment key={category}>
                          <tr className="bg-slate-950/30">
                            <td
                              colSpan={4}
                              className="py-1.5 pl-4 text-[10px] font-bold uppercase tracking-widest text-slate-500"
                            >
                              {CATEGORY_LABELS[category] ?? category}
                            </td>
                          </tr>
                          {rows.map((row) => (
                            <tr key={row.id} className="border-t border-slate-800/50">
                              <td className="py-2 pl-4 pr-2 align-middle">
                                <p
                                  className="font-medium text-slate-200 text-[11px] leading-tight"
                                  title={row.description}
                                >
                                  {row.label}
                                </p>
                                {row.description ? (
                                  <p className="mt-0.5 text-[10px] text-slate-500 leading-snug line-clamp-2">
                                    {row.description}
                                  </p>
                                ) : null}
                              </td>
                              {CORE_PLANS.map((p) => (
                                <td key={p.code} className="px-2 py-2 text-center align-middle">
                                  <div className="flex min-h-[2rem] items-center justify-center">
                                    <FeatureCell cell={row.values[p.code]} />
                                  </div>
                                </td>
                              ))}
                            </tr>
                          ))}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="mt-3 grid gap-2 rounded-xl border border-slate-700/35 bg-slate-950/25 p-3 text-[10px] text-slate-500 leading-snug sm:grid-cols-2 lg:grid-cols-4">
          <p>
            <span className="font-semibold text-slate-400">Upgrade:</span>{" "}
            {BILLING_CATALOG.policies.upgrade}
          </p>
          <p>
            <span className="font-semibold text-slate-400">Add-ons Core:</span>{" "}
            {BILLING_CATALOG.policies.customAddons}
          </p>
          <p>
            <span className="font-semibold text-slate-400">Módulos avulsos:</span>{" "}
            {BILLING_CATALOG.policies.standaloneModules}
          </p>
          <p>
            <span className="font-semibold text-slate-400">Facturação:</span>{" "}
            {BILLING_CATALOG.policies.billing}
          </p>
        </div>

        <ScrollReveal delay={120}>
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3 rounded-xl border border-blue-500/20 bg-gradient-to-r from-blue-600/10 via-transparent to-teal-600/10 px-5 py-6 text-center">
            <div className="max-w-xl">
              <h3 className="text-base font-bold text-slate-100 mb-1">
                Precisa de um pacote personalizado?
              </h3>
              <p className="text-xs text-slate-400">
                Core formativo, módulos avulsos (ex.: só CRM) ou combinações personalizadas - a
                equipa comercial activa o pacote exacto.
              </p>
            </div>
            <button
              type="button"
              onClick={() => openContact()}
              className="shrink-0 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 px-5 py-2.5 text-xs font-semibold text-white hover:shadow-lg hover:shadow-blue-500/25 transition-all"
            >
              Pedir proposta comercial
            </button>
          </div>
        </ScrollReveal>

        <StandaloneModulesSection onSelectModule={openStandaloneModule} />
      </section>

      <SalesContactDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        defaultPlano={selectedPlan}
        defaultAddons={defaultAddons}
      />
    </>
  );
}
