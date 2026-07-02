import {
  calcularTotaisFatura,
  calcularValorIvaCentavos,
} from "../faturas/fatura-iva.util";

export type PropostaLinhaInput = {
  descricao: string;
  notas?: string | null;
  quantidade: number;
  precoUnitCentavos: number;
  taxaIva: number;
};

export type PropostaLinhaNormalizada = PropostaLinhaInput & {
  valorIvaCentavos: number;
};

export function normalizePropostaLinha(
  linha: PropostaLinhaInput,
  taxaPadrao = 23,
): PropostaLinhaNormalizada {
  const quantidade = linha.quantidade > 0 ? linha.quantidade : 1;
  const taxaIva = linha.taxaIva >= 0 ? linha.taxaIva : taxaPadrao;
  const valorIvaCentavos = calcularValorIvaCentavos({
    quantidade,
    precoUnitCentavos: linha.precoUnitCentavos,
    taxaIva,
  });
  const notas = linha.notas?.trim() || null;
  return {
    descricao: linha.descricao.trim(),
    notas,
    quantidade,
    precoUnitCentavos: linha.precoUnitCentavos,
    taxaIva,
    valorIvaCentavos,
  };
}

export function normalizePropostaLinhas(
  linhas: PropostaLinhaInput[],
  taxaPadrao = 23,
): PropostaLinhaNormalizada[] {
  return linhas
    .filter((l) => l.descricao.trim().length > 0)
    .map((l) => normalizePropostaLinha(l, taxaPadrao));
}

export function totaisPropostaLinhas(linhas: PropostaLinhaInput[]) {
  return calcularTotaisFatura(linhas);
}
