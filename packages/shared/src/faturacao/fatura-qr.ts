export type FaturaQrInput = {
  nifEmitente: string;
  nifCliente: string;
  tipoDocumento: string;
  dataEmissao: Date;
  identificacaoDocumento: string;
  atcud: string;
  totalSemIvaCentavos: number;
  totalIvaCentavos: number;
  hashIntegridade?: string | null;
  softwareCertificado?: string | null;
};

/** Posições 1, 11, 21 e 31 do hash do documento; «0» se não certificado. */
export function extrairHashCharacters(
  hashIntegridade: string | null | undefined,
  softwareCertificado: string | null | undefined,
): string {
  if (!softwareCertificado?.trim() || !hashIntegridade?.trim()) return "0";
  const h = hashIntegridade.trim();
  if (h.length < 31) return "0";
  return `${h[0] ?? "0"}${h[10] ?? "0"}${h[20] ?? "0"}${h[30] ?? "0"}`;
}

/**
 * Payload QR - Portaria 195/2020 / especificações AT.
 * Campos obrigatórios A–H, I1, N, O, Q, R (ordem fixa, separador «*»).
 */
export function buildFaturaQrPayload(input: FaturaQrInput): string {
  const data = input.dataEmissao.toISOString().slice(0, 10).replace(/-/g, "");
  const totalComIva = ((input.totalSemIvaCentavos + input.totalIvaCentavos) / 100).toFixed(2);
  const totalIva = (input.totalIvaCentavos / 100).toFixed(2);
  const base = (input.totalSemIvaCentavos / 100).toFixed(2);
  const hashChars = extrairHashCharacters(
    input.hashIntegridade,
    input.softwareCertificado ?? "0",
  );
  const certNo = input.softwareCertificado?.trim() || "0";

  const parts = [
    `A:${input.nifEmitente}`,
    `B:${input.nifCliente}`,
    `C:PT`,
    `D:${input.tipoDocumento}`,
    `E:N`,
    `F:${data}`,
    `G:${input.identificacaoDocumento}`,
    `H:${input.atcud}`,
    `I1:PT`,
    `I7:${base}`,
    `I8:${totalIva}`,
    `N:${totalIva}`,
    `O:${totalComIva}`,
    `Q:${hashChars}`,
    `R:${certNo}`,
  ];
  return parts.join("*");
}
