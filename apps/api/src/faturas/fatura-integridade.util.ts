import { createHash } from "node:crypto";

export type FaturaIntegridadeInput = {
  tenantId: string;
  faturaId: string;
  nifEmitente: string;
  destinatarioNif: string;
  tipoDocumento: string;
  serie: string;
  numero: number;
  atcud: string;
  dataEmissao: Date;
  valorCentavos: number;
  ivaCentavos: number;
  moeda: string;
  softwareCertificado: string | null;
  linhas: Array<{
    ordem: number;
    descricao: string;
    quantidade: number;
    precoUnitCentavos: number;
    taxaIva: number;
    valorIvaCentavos: number;
  }>;
};

/** Representação canónica imutável do documento emitido (auditoria / certificação AT). */
export function buildFaturaIntegridadeCanonical(input: FaturaIntegridadeInput): string {
  const doc = {
    v: 1,
    tenantId: input.tenantId,
    faturaId: input.faturaId,
    nifEmitente: input.nifEmitente,
    nifCliente: input.destinatarioNif,
    tipo: input.tipoDocumento,
    serie: input.serie,
    numero: input.numero,
    atcud: input.atcud,
    data: input.dataEmissao.toISOString(),
    base: input.valorCentavos,
    iva: input.ivaCentavos,
    moeda: input.moeda,
    software: input.softwareCertificado,
    linhas: input.linhas.map((l) => ({
      o: l.ordem,
      d: l.descricao.slice(0, 120),
      q: l.quantidade,
      p: l.precoUnitCentavos,
      t: l.taxaIva,
      v: l.valorIvaCentavos,
    })),
  };
  return JSON.stringify(doc);
}

export function hashIntegridadeFatura(input: FaturaIntegridadeInput): string {
  return createHash("sha256").update(buildFaturaIntegridadeCanonical(input)).digest("hex");
}
