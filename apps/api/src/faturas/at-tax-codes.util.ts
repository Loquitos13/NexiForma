import {
  AT_MOTIVO_ISENCAO_DEFAULT,
  AT_MOTIVOS_ISENCAO,
  isMotivoIsencaoAtValido,
  type AtMotivoIsencaoCodigo,
} from "@nexiforma/shared";

export { AT_MOTIVOS_ISENCAO };
export type AtMotivoIsencao = AtMotivoIsencaoCodigo;

export type AtTaxCode = "RED" | "INT" | "NOR" | "ISE" | "OUT" | "NS";

/** Taxa IVA PT continental → código AT (TaxCode). */
export function resolverTaxCodeIva(taxaIva: number): AtTaxCode {
  if (taxaIva <= 0) return "ISE";
  if (Math.abs(taxaIva - 6) < 0.01) return "RED";
  if (Math.abs(taxaIva - 13) < 0.01) return "INT";
  if (Math.abs(taxaIva - 23) < 0.01) return "NOR";
  return "OUT";
}

export function isMotivoIsencaoValido(code: string | null | undefined): code is AtMotivoIsencao {
  return isMotivoIsencaoAtValido(code);
}

/** Obrigatório quando TaxPercentage = 0 (manual AT 1.6.14.8). */
export function resolverTaxExemptionCode(
  taxaIva: number,
  codigoLinha?: string | null,
): AtMotivoIsencao | null {
  if (taxaIva > 0) return null;
  const raw = codigoLinha?.trim().toUpperCase();
  if (raw && isMotivoIsencaoValido(raw)) return raw;
  return AT_MOTIVO_ISENCAO_DEFAULT;
}

/** Indicador débito/crédito por tipo documento (manual 1.6.14.4). */
export function resolverDebitCreditIndicator(tipoDocumento: string): "C" | "D" {
  const t = tipoDocumento.toUpperCase();
  return t === "NC" || t === "ND" ? "D" : "C";
}

export { extrairHashCharacters } from "@nexiforma/shared";
