import { createHash } from "node:crypto";

const CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Código de validação de série (8 caracteres) - substituir pelo código AT após registo oficial. */
export function gerarCodigoValidacaoSerie(
  tenantId: string,
  serieCodigo: string,
  tipo: string,
): string {
  const digest = createHash("sha256")
    .update(`${tenantId}:${serieCodigo}:${tipo}:nexiforma-at`)
    .digest();
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += CHARSET[digest[i]! % CHARSET.length];
  }
  return code;
}

export function formatarAtcud(codigoValidacao: string, numero: number): string {
  return `${codigoValidacao}-${numero}`;
}

export type FaturaQrInput = {
  nifEmitente: string;
  nifCliente: string;
  tipoDocumento: string;
  dataEmissao: Date;
  identificacaoDocumento: string;
  atcud: string;
  totalSemIvaCentavos: number;
  totalIvaCentavos: number;
};

/** Payload QR conforme campos essenciais do formato AT (Portaria 195/2020). */
export function buildFaturaQrPayload(input: FaturaQrInput): string {
  const data = input.dataEmissao.toISOString().slice(0, 10).replace(/-/g, "");
  const totalComIva = ((input.totalSemIvaCentavos + input.totalIvaCentavos) / 100).toFixed(2);
  const totalIva = (input.totalIvaCentavos / 100).toFixed(2);
  const base = (input.totalSemIvaCentavos / 100).toFixed(2);

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
    `N:${totalComIva}`,
    `O:${totalIva}`,
  ];
  return parts.join("*");
}
