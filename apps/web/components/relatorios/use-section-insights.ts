"use client";



import { useCallback, useEffect, useRef, useState } from "react";

import type { RelatorioInsightsRequest } from "@nexiforma/shared";

import { readChartInsightsCache } from "./chart-insights-cache";



/** Insights de gráficos no dashboard: só mostra texto já gerado em Relatórios (sem chamada IA). */

export function useSectionChartInsights(

  secao: RelatorioInsightsRequest["secao"],

  enabled: boolean,

  _active: boolean,

) {

  const [descricoes, setDescricoes] = useState(() =>

    enabled ? readChartInsightsCache(secao) : null,

  );

  const visibleRef = useRef<HTMLDivElement | null>(null);



  const refresh = useCallback(() => {

    if (!enabled) {

      setDescricoes(null);

      return;

    }

    setDescricoes(readChartInsightsCache(secao));

  }, [secao, enabled]);



  useEffect(() => {

    refresh();

    const onStorage = (e: StorageEvent) => {

      if (e.key?.startsWith("nexiforma-chart-insights:")) refresh();

    };

    window.addEventListener("storage", onStorage);

    return () => window.removeEventListener("storage", onStorage);

  }, [refresh]);



  function getDescricao(tituloGrafico: string): string | null {

    if (!descricoes?.length) return null;

    const exact = descricoes.find((d) => d.titulo === tituloGrafico);

    if (exact) return exact.descricao;

    const partial = descricoes.find(

      (d) =>

        d.titulo.toLowerCase().includes(tituloGrafico.toLowerCase()) ||

        tituloGrafico.toLowerCase().includes(d.titulo.toLowerCase()),

    );

    return partial?.descricao ?? null;

  }



  return { getDescricao, loading: false, descricoes, visibleRef };

}

