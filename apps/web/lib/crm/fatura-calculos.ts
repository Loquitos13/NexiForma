export type LinhaFaturaInput = {
  quantidade: number;
  precoUnitCentavos: number;
  taxaIva: number;
  descontoPercent?: number;
};

function clampDescontoPercent(value: number | undefined): number {
  if (value == null || !Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

export function calcularBaseLinhaCentavos(linha: LinhaFaturaInput): number {
  const bruto = Math.round(linha.quantidade * linha.precoUnitCentavos);
  const desc = clampDescontoPercent(linha.descontoPercent);
  if (desc <= 0) return bruto;
  return Math.round(bruto * (1 - desc / 100));
}

export function calcularValorIvaCentavos(linha: LinhaFaturaInput): number {
  const base = calcularBaseLinhaCentavos(linha);
  return Math.round((base * linha.taxaIva) / 100);
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

export function parsePercentInput(raw: string): number {
  const n = Number.parseFloat(raw.replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(100, n);
}

export function formatarPercentInput(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number.parseFloat(value.replace(",", ".")) : Number(value);
  if (!Number.isFinite(n) || n <= 0) return "0";
  return String(n);
}
