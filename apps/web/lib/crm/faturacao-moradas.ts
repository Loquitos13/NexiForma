export function resolveMoradaCarga(
  moradaCarga: string | null | undefined,
  moradaFiscalEmitente: string | null | undefined,
): string {
  const custom = moradaCarga?.trim();
  if (custom) return custom;
  return moradaFiscalEmitente?.trim() ?? "";
}

export function resolveMoradaDescarga(
  moradaDescarga: string | null | undefined,
  moradaDestinatario: string | null | undefined,
): string {
  const custom = moradaDescarga?.trim();
  if (custom) return custom;
  return moradaDestinatario?.trim() ?? "";
}
