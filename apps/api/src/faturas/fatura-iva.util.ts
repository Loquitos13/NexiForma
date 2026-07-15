export type LinhaIvaInput = {
  quantidade: number;
  precoUnitCentavos: number;
  taxaIva: number;
  descontoPercent?: number;
  codigoIsencaoIva?: string | null;
};

function clampDescontoPercent(value: number | undefined): number {
  if (value == null || !Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

export function calcularBaseLinhaCentavos(linha: LinhaIvaInput): number {
  const bruto = Math.round(linha.quantidade * linha.precoUnitCentavos);
  const desc = clampDescontoPercent(linha.descontoPercent);
  if (desc <= 0) return bruto;
  return Math.round(bruto * (1 - desc / 100));
}

export function calcularValorIvaCentavos(linha: LinhaIvaInput): number {
  const base = calcularBaseLinhaCentavos(linha);
  return Math.round((base * linha.taxaIva) / 100);
}

export function calcularTotaisFatura(linhas: LinhaIvaInput[]): {
  valorCentavos: number;
  ivaCentavos: number;
} {
  let valorCentavos = 0;
  let ivaCentavos = 0;
  for (const linha of linhas) {
    valorCentavos += calcularBaseLinhaCentavos(linha);
    ivaCentavos += calcularValorIvaCentavos(linha);
  }
  return { valorCentavos, ivaCentavos };
}

/** Total a pagar após retenção na fonte (fase 2). */
export function calcularTotalLiquidoCentavos(
  valorCentavos: number,
  ivaCentavos: number,
  retencaoCentavos = 0,
): number {
  const ret = Math.max(0, Math.min(retencaoCentavos, valorCentavos + ivaCentavos));
  return valorCentavos + ivaCentavos - ret;
}
