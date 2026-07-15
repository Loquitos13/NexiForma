import type { RelatorioComparacoes, RelatorioKpi, RelatorioSerieMensal } from "@nexiforma/shared";

export type PeriodoComparacao = "dia" | "semana" | "mes" | "trimestre" | "semestre";

export const PERIODO_OPCOES: { id: PeriodoComparacao; label: string }[] = [
  { id: "dia", label: "Dia" },
  { id: "semana", label: "Semana" },
  { id: "mes", label: "Mês" },
  { id: "trimestre", label: "Trimestre" },
  { id: "semestre", label: "Semestre" },
];

type CompKey = keyof RelatorioComparacoes;

/** Mapeia o filtro de período à comparação temporal disponível nos KPIs. */
export function comparacaoParaPeriodo(periodo: PeriodoComparacao): {
  key: CompKey;
  label: string;
} {
  switch (periodo) {
    case "dia":
    case "semana":
    case "mes":
      return { key: "mesAnterior", label: "vs. mês anterior" };
    case "trimestre":
      return { key: "trimestreAnterior", label: "vs. trimestre anterior" };
    case "semestre":
      return { key: "semestreAnterior", label: "vs. semestre anterior" };
  }
}

export function sliceSeriePorPeriodo(
  serie: RelatorioSerieMensal[],
  periodo: PeriodoComparacao,
): RelatorioSerieMensal[] {
  if (!serie.length) return serie;
  switch (periodo) {
    case "dia":
      return serie.slice(-1);
    case "semana":
      return serie.slice(-4);
    case "mes":
      return serie.slice(-6);
    case "trimestre":
      return serie.slice(-3);
    case "semestre":
      return serie.slice(-6);
    default:
      return serie;
  }
}

export function resumoKpisPeriodo(kpis: RelatorioKpi[], periodo: PeriodoComparacao) {
  const { key, label } = comparacaoParaPeriodo(periodo);
  return kpis.map((kpi) => ({
    kpi,
    comparacao: kpi.comparacoes[key],
    comparacaoLabel: label,
  }));
}
