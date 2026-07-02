/** Códigos oficiais AT (Portaria 302/2016 + tabela v4.0 Jun/2026). */
export const AT_MOTIVOS_ISENCAO = [
  "M01",
  "M02",
  "M04",
  "M05",
  "M06",
  "M07",
  "M09",
  "M10",
  "M11",
  "M12",
  "M13",
  "M14",
  "M15",
  "M16",
  "M19",
  "M20",
  "M21",
  "M25",
  "M26",
  "M30",
  "M31",
  "M32",
  "M33",
  "M34",
  "M35",
  "M40",
  "M41",
  "M42",
  "M43",
  "M44",
  "M45",
  "M46",
  "M99",
] as const;

export type AtMotivoIsencao = (typeof AT_MOTIVOS_ISENCAO)[number];

export type AtTaxCode = "RED" | "INT" | "NOR" | "ISE" | "OUT" | "NS";

const MOTIVO_SET = new Set<string>(AT_MOTIVOS_ISENCAO);

/** Taxa IVA PT continental → código AT (TaxCode). */
export function resolverTaxCodeIva(taxaIva: number): AtTaxCode {
  if (taxaIva <= 0) return "ISE";
  if (Math.abs(taxaIva - 6) < 0.01) return "RED";
  if (Math.abs(taxaIva - 13) < 0.01) return "INT";
  if (Math.abs(taxaIva - 23) < 0.01) return "NOR";
  return "OUT";
}

export function isMotivoIsencaoValido(code: string | null | undefined): code is AtMotivoIsencao {
  return !!code && MOTIVO_SET.has(code.toUpperCase());
}

/** Obrigatório quando TaxPercentage = 0 (manual AT 1.6.14.8). */
export function resolverTaxExemptionCode(
  taxaIva: number,
  codigoLinha?: string | null,
): AtMotivoIsencao | null {
  if (taxaIva > 0) return null;
  const raw = codigoLinha?.trim().toUpperCase();
  if (raw && isMotivoIsencaoValido(raw)) return raw;
  return "M07";
}

/** Indicador débito/crédito por tipo documento (manual 1.6.14.4). */
export function resolverDebitCreditIndicator(tipoDocumento: string): "C" | "D" {
  const t = tipoDocumento.toUpperCase();
  return t === "NC" || t === "ND" ? "D" : "C";
}

export { extrairHashCharacters } from "@nexiforma/shared";
