"use client";

import type { ReactNode } from "react";
import { ChartInsightBlurb } from "./chart-insight-blurb";
import { useSectionChartInsights } from "./use-section-insights";
import type { RelatorioInsightsRequest } from "@nexiforma/shared";

type Props = {
  secao: RelatorioInsightsRequest["secao"];
  tituloGrafico: string;
  enterprise: boolean;
  children: ReactNode;
};

export function ChartWithEnterpriseInsight({ secao, tituloGrafico, enterprise, children }: Props) {
  const { getDescricao, loading } = useSectionChartInsights(secao, enterprise, enterprise);

  return (
    <div>
      {children}
      <ChartInsightBlurb
        enterprise={enterprise}
        loading={loading}
        titulo={tituloGrafico}
        descricao={getDescricao(tituloGrafico)}
      />
    </div>
  );
}
