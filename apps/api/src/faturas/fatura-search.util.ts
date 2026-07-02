import type { Prisma } from "@nexiforma/database";

/** Converte texto de pesquisa (ex. 2000, 2000,50) para cêntimos, se aplicável. */
export function parseEurosPesquisaCentavos(raw: string): number | null {
  const q = raw.trim().replace(/\s/g, "").replace(/€/g, "");
  if (!q || !/^[\d.,]+$/.test(q)) return null;
  const normalized = q.includes(",") ? q.replace(/\./g, "").replace(",", ".") : q;
  const value = Number.parseFloat(normalized);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

function isNumericQuery(raw: string): boolean {
  return /^\d+$/.test(raw.trim().replace(/\s/g, ""));
}

/**
 * Condições OR para pesquisa de faturas (backend):
 * NIF parcial, cliente, valor, nº fatura, ATCUD.
 */
export function buildFaturaSearchOr(q: string): Prisma.FaturaComercialWhereInput[] {
  const trimmed = q.trim();
  if (!trimmed) return [];

  const or: Prisma.FaturaComercialWhereInput[] = [];
  const nifDigits = trimmed.replace(/\D/g, "");
  const numeric = isNumericQuery(trimmed);

  // NIF / contribuinte - prefixo parcial desde o 1.º dígito
  if (nifDigits.length > 0 && (numeric || nifDigits.length >= 2)) {
    or.push({ destinatarioNif: { contains: nifDigits } });
    or.push({ entidadeCliente: { is: { nif: { contains: nifDigits } } } });
  }

  // Nº fatura: FT 2026/2, 2026/2, 2026-2
  const refMatch = trimmed.match(/^(?:(FT|NC|ND)\s*)?(\d+)\s*[/-]\s*(\d+)$/i);
  if (refMatch) {
    const serieCodigo = refMatch[2]!;
    const numero = Number.parseInt(refMatch[3]!, 10);
    if (Number.isFinite(numero)) {
      or.push({
        AND: [{ serie: { is: { codigo: serieCodigo } } }, { numero }],
      });
    }
  }

  if (numeric) {
    or.push({ serie: { is: { codigo: { contains: trimmed } } } });
    const numero = Number.parseInt(trimmed, 10);
    if (Number.isFinite(numero) && trimmed.length <= 8) {
      or.push({ numero });
    }
    const cents = parseEurosPesquisaCentavos(trimmed);
    if (cents != null) {
      or.push({ valorCentavos: cents });
      or.push({ ivaCentavos: cents });
    }
  } else {
    or.push({ destinatarioNome: { contains: trimmed, mode: "insensitive" } });
    or.push({
      entidadeCliente: { is: { nome: { contains: trimmed, mode: "insensitive" } } },
    });
    if (trimmed.length >= 2) {
      or.push({ codigoAtcud: { contains: trimmed, mode: "insensitive" } });
    }
  }

  return or;
}

export function mergeFaturaSearchWhere(
  base: Prisma.FaturaComercialWhereInput,
  q?: string,
): Prisma.FaturaComercialWhereInput {
  const or = q?.trim() ? buildFaturaSearchOr(q) : [];
  if (or.length === 0) return base;
  return { AND: [base, { OR: or }] };
}
