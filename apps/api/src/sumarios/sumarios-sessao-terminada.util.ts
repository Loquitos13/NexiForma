/** Sumário só é editável/assinável após a sessão ter `terminadaEm`. */
export function sessaoPermiteSumario(sessao: {
  terminadaEm: Date | string | null | undefined;
}): boolean {
  return Boolean(sessao.terminadaEm);
}
