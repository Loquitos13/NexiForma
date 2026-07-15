"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2, Euro, LayoutGrid, RotateCcw, Settings2, TrendingUp } from "lucide-react";
import type { RelatorioDashboard } from "@nexiforma/shared";
import { CategorySliderPanel } from "@/components/dashboard/category-slider-panel";
import { DashboardBlockShell } from "@/components/dashboard/dashboard-block-shell";
import {
  DashboardAtalhosPanel,
  DashboardFormacaoOperacionalPanel,
  DashboardFormacaoResumoPanel,
  type DashboardPortalContext,
} from "@/components/dashboard/dashboard-panels";
import { getBlockEntry, type DashboardBlockId } from "@/lib/dashboard/dashboard-blocks";
import {
  DEFAULT_DASHBOARD_LAYOUT_V3,
  loadDashboardLayoutV3,
  saveDashboardLayoutV3,
  updateBlockWidth,
  visibleBlocks,
  getBlockLayout,
  type DashboardLayoutV3,
} from "@/lib/dashboard/widget-layout-v3";
import { cn } from "@/lib/ui/cn";

const STORAGE_KEY = "nexiforma-gestor-dashboard-v3";

const SLIDER_META: Record<
  "slider-financeiro" | "slider-comercial" | "slider-empresarial",
  { icon: React.ReactNode; borderClass: string; reportHref: string; category: "financeiro" | "comercial" | "empresarial" }
> = {
  "slider-financeiro": {
    category: "financeiro",
    icon: <Euro className="h-4 w-4 text-emerald-400" />,
    borderClass: "border-emerald-500/15",
    reportHref: "/portal/relatorios",
  },
  "slider-comercial": {
    category: "comercial",
    icon: <TrendingUp className="h-4 w-4 text-blue-400" />,
    borderClass: "border-blue-500/15",
    reportHref: "/portal/crm",
  },
  "slider-empresarial": {
    category: "empresarial",
    icon: <Building2 className="h-4 w-4 text-violet-400" />,
    borderClass: "border-violet-500/15",
    reportHref: "/portal/relatorios",
  },
};

export function GestorExecutiveDashboard({
  data,
  enterprise,
  portalContext,
  storageKey = STORAGE_KEY,
}: {
  data: RelatorioDashboard;
  enterprise: boolean;
  portalContext?: DashboardPortalContext;
  storageKey?: string;
}) {
  const [layout, setLayout] = useState<DashboardLayoutV3>(DEFAULT_DASHBOARD_LAYOUT_V3);
  const [editMode, setEditMode] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setLayout(loadDashboardLayoutV3(storageKey));
    setHydrated(true);
  }, [storageKey]);

  const persist = useCallback(
    (next: DashboardLayoutV3) => {
      setLayout(next);
      saveDashboardLayoutV3(storageKey, next);
    },
    [storageKey],
  );

  if (!hydrated) {
    return <p className="text-sm text-slate-500">A preparar dashboard…</p>;
  }

  const blocks = visibleBlocks(layout);

  function renderBlock(blockId: DashboardBlockId) {
    const block = getBlockLayout(layout, blockId);
    if (!block?.visible) return null;
    const entry = getBlockEntry(blockId);
    const widthCols = block.widthCols;

    const shell = (child: React.ReactNode) => (
      <DashboardBlockShell
        key={blockId}
        blockId={blockId}
        label={entry?.label ?? blockId}
        widthCols={widthCols}
        editMode={editMode}
        onWidthChange={(cols) => persist(updateBlockWidth(layout, blockId, cols))}
      >
        {child}
      </DashboardBlockShell>
    );

    if (blockId === "slider-financeiro" || blockId === "slider-comercial" || blockId === "slider-empresarial") {
      const meta = SLIDER_META[blockId];
      return shell(
        <CategorySliderPanel
          category={meta.category}
          data={data}
          layout={layout}
          sliderWidthCols={widthCols}
          editMode={editMode}
          enterprise={enterprise}
          reportHref={meta.reportHref}
          icon={meta.icon}
          borderClass={meta.borderClass}
          onLayoutChange={persist}
        />,
      );
    }

    if (blockId === "panel-formacao-resumo") {
      return shell(<DashboardFormacaoResumoPanel aggregates={portalContext?.aggregates} />);
    }

    if (blockId === "panel-formacao-operacional" && portalContext) {
      return shell(
        <DashboardFormacaoOperacionalPanel
          compliance={portalContext.compliance}
          alertas={portalContext.alertas}
          alertasCc={portalContext.alertasCc}
          notifyBusy={portalContext.notifyBusy}
          notifyMsg={portalContext.notifyMsg}
          onDigest={portalContext.onDigest}
        />,
      );
    }

    if (blockId === "panel-atalhos") {
      return shell(<DashboardAtalhosPanel />);
    }

    return null;
  }

  return (
    <div className="space-y-4">
      {!enterprise ? (
        <p className="rounded-lg border border-amber-500/25 bg-amber-950/20 px-4 py-2.5 text-xs text-amber-200/90">
          Plano Business: sliders com indicadores e gráficos. Enterprise inclui análise IA e sugestões CRM por cliente.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-2">
        {editMode ? (
          <button
            type="button"
            onClick={() => persist(DEFAULT_DASHBOARD_LAYOUT_V3)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700/60 px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-800"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Repor
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => setEditMode((e) => !e)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
            editMode
              ? "border-violet-500/50 bg-violet-900/30 text-violet-200"
              : "border-slate-700/60 bg-slate-900/80 text-slate-300 hover:bg-slate-800",
          )}
        >
          {editMode ? (
            <>
              <LayoutGrid className="h-3.5 w-3.5" />
              Concluir
            </>
          ) : (
            <>
              <Settings2 className="h-3.5 w-3.5" />
              Personalizar
            </>
          )}
        </button>
      </div>

      {editMode ? (
        <p className="text-xs text-slate-500">
          Ajuste a largura de cada bloco com ◀ ▶ (4–12 colunas). KPIs compactos agrupam-se automaticamente
          no mesmo slide quando há espaço; com slider estreito empilham-se e geram mais slides. Gráficos
          e IA ocupam sempre um slide inteiro.
        </p>
      ) : null}

      <div className="flex flex-wrap items-start gap-x-4 gap-y-4">
        {blocks.map((b) => renderBlock(b.id))}
      </div>
    </div>
  );
}
