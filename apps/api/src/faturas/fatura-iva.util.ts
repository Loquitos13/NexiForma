export type LinhaIvaInput = {
  quantidade: number;
  precoUnitCentavos: number;
  taxaIva: number;
  codigoIsencaoIva?: string | null;
};

export function calcularValorIvaCentavos(linha: LinhaIvaInput): number {
  const base = Math.round(linha.quantidade * linha.precoUnitCentavos);
  return Math.round((base * linha.taxaIva) / 100);
}

export function calcularTotaisFatura(linhas: LinhaIvaInput[]): {
  valorCentavos: number;
  ivaCentavos: number;
} {
  let valorCentavos = 0;
  let ivaCentavos = 0;
  for (const linha of linhas) {
    const base = Math.round(linha.quantidade * linha.precoUnitCentavos);
    valorCentavos += base;
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
