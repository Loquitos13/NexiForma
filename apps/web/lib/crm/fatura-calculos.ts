export type LinhaFaturaInput = {
  quantidade: number;
  precoUnitCentavos: number;
  taxaIva: number;
};

export function calcularValorIvaCentavos(linha: LinhaFaturaInput): number {
  const base = Math.round(linha.quantidade * linha.precoUnitCentavos);
  return Math.round((base * linha.taxaIva) / 100);
}

export function calcularBaseLinhaCentavos(linha: LinhaFaturaInput): number {
  return Math.round(linha.quantidade * linha.precoUnitCentavos);
}

export function calcularTotaisLinhas(
  linhas: LinhaFaturaInput[],
): { valorCentavos: number; ivaCentavos: number } {
  let valorCentavos = 0;
  let ivaCentavos = 0;
  for (const linha of linhas) {
    valorCentavos += calcularBaseLinhaCentavos(linha);
    ivaCentavos += calcularValorIvaCentavos(linha);
  }
  return { valorCentavos, ivaCentavos };
}

export function eurosParaCentavos(euros: number): number {
  return Math.round(euros * 100);
}

export function centavosParaEuros(centavos: number): number {
  return centavos / 100;
}

export function formatarEurosInput(centavos: number): string {
  return centavosParaEuros(centavos).toFixed(2);
}

export function parseEurosInput(raw: string): number {
  const n = Number.parseFloat(raw.replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return 0;
  return eurosParaCentavos(n);
}
