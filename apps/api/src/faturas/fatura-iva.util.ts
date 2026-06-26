export type LinhaIvaInput = {
  quantidade: number;
  precoUnitCentavos: number;
  taxaIva: number;
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
