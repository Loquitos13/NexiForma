/** Morada de carga efectiva: personalizada ou morada fiscal do emitente. */
export function resolveMoradaCarga(
  moradaCarga: string | null | undefined,
  moradaFiscalEmitente: string | null | undefined,
): string {
  const custom = moradaCarga?.trim();
  if (custom) return custom;
  return moradaFiscalEmitente?.trim() ?? "";
}

/** Morada de descarga efectiva: personalizada ou morada do destinatário. */
export function resolveMoradaDescarga(
  moradaDescarga: string | null | undefined,
  moradaDestinatario: string | null | undefined,
): string {
  const custom = moradaDescarga?.trim();
  if (custom) return custom;
  return moradaDestinatario?.trim() ?? "";
}

/** Normaliza input da API: string vazia → null (aplica omissão na resolução). */
export function normalizeMoradaOpcional(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
