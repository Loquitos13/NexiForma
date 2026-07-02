import { createHash } from "node:crypto";

import { buildFaturaQrPayload, type FaturaQrInput } from "@nexiforma/shared";



export type { FaturaQrInput };

export { buildFaturaQrPayload };



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

