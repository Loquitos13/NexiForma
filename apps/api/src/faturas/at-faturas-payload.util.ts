import { createHash } from "node:crypto";
import {
  AT_FATURAS_NS,
  AT_SOAP_ENVELOPE_NS,
  AT_WSSE_NS,
} from "./at-faturas-constants";
import type { AtSecurityHeaderFields } from "./at-faturas-security.util";

export type AtInvoiceStatus = "N" | "A";

export type AtFaturaDocumentoInput = {
  nifEmitente: string;
  nifCliente: string;
  tipoDocumento: string;
  serie: string;
  numero: number;
  atcud: string;
  dataEmissao: Date;
  valorCentavos: number;
  ivaCentavos: number;
  moeda: string;
  invoiceStatus?: AtInvoiceStatus;
  linhas: Array<{
    descricao: string;
    quantidade: number;
    precoUnitCentavos: number;
    taxaIva: number;
    valorIvaCentavos: number;
  }>;
};

export type AtLinhaResumoTaxa = {
  taxaIva: number;
  baseCentavos: number;
  ivaCentavos: number;
};

export function identificacaoDocumentoAt(tipo: string, serie: string, numero: number): string {
  return `${tipo} ${serie}/${numero}`;
}

export function formatarEuroAt(centavos: number): string {
  return (centavos / 100).toFixed(2);
}

/** Agrupa linhas por taxa IVA – uma Line por taxa (spec AT). */
export function agruparLinhasPorTaxa(linhas: AtFaturaDocumentoInput["linhas"]): AtLinhaResumoTaxa[] {
  const map = new Map<number, AtLinhaResumoTaxa>();
  for (const l of linhas) {
    const taxa = Number(l.taxaIva);
    const base = Math.round(Number(l.quantidade) * l.precoUnitCentavos);
    const prev = map.get(taxa) ?? { taxaIva: taxa, baseCentavos: 0, ivaCentavos: 0 };
    prev.baseCentavos += base;
    prev.ivaCentavos += l.valorIvaCentavos;
    map.set(taxa, prev);
  }
  return [...map.values()].sort((a, b) => a.taxaIva - b.taxaIva);
}

export function normalizarNifCliente(nif: string): string {
  const digits = nif.replace(/\D/g, "");
  return digits.length >= 9 ? digits.slice(0, 9) : "999999990";
}

/** Representação canónica para hash de auditoria (sem guardar payload em claro). */
export function buildAtFaturaPayloadCanonical(input: AtFaturaDocumentoInput): string {
  const doc = {
    nifEmitente: input.nifEmitente,
    nifCliente: input.nifCliente,
    tipo: input.tipoDocumento,
    id: identificacaoDocumentoAt(input.tipoDocumento, input.serie, input.numero),
    atcud: input.atcud,
    status: input.invoiceStatus ?? "N",
    data: input.dataEmissao.toISOString().slice(0, 10),
    base: input.valorCentavos,
    iva: input.ivaCentavos,
    moeda: input.moeda,
    linhas: input.linhas.map((l) => ({
      d: l.descricao.slice(0, 60),
      q: l.quantidade,
      p: l.precoUnitCentavos,
      t: l.taxaIva,
      v: l.valorIvaCentavos,
    })),
  };
  return JSON.stringify(doc);
}

export function hashAtFaturaPayload(input: AtFaturaDocumentoInput): string {
  return createHash("sha256").update(buildAtFaturaPayloadCanonical(input)).digest("hex");
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildLineXml(tipo: string, grupo: AtLinhaResumoTaxa): string {
  const amount = formatarEuroAt(grupo.baseCentavos);
  const amountTag = tipo === "NC" ? "DebitAmount" : "CreditAmount";
  const exemption =
    grupo.taxaIva === 0
      ? `<TaxExemptionReason>M07</TaxExemptionReason>`
      : "";
  return `<Line>
        <${amountTag}>${amount}</${amountTag}>
        <Tax>
          <TaxType>IVA</TaxType>
          <TaxCountryRegion>PT</TaxCountryRegion>
          <TaxPercentage>${grupo.taxaIva.toFixed(2)}</TaxPercentage>
          ${exemption}
        </Tax>
      </Line>`;
}

/**
 * Envelope SOAP RegisterInvoice conforme factemiws / manual AT.
 * Header WS-Security com Password/Nonce/Created cifrados.
 */
export function buildRegisterInvoiceSoapEnvelope(
  security: AtSecurityHeaderFields,
  documento: AtFaturaDocumentoInput,
): string {
  const ns = AT_FATURAS_NS;
  const tipo = documento.tipoDocumento.toUpperCase();
  const status = documento.invoiceStatus ?? "N";
  const invoiceNo = identificacaoDocumentoAt(tipo, documento.serie, documento.numero);
  const invoiceDate = documento.dataEmissao.toISOString().slice(0, 10);
  const customerTaxId = normalizarNifCliente(documento.nifCliente);
  const nifEmitente = documento.nifEmitente.replace(/\D/g, "").slice(0, 9);

  const grupos = agruparLinhasPorTaxa(documento.linhas);
  const linesXml = grupos.map((g) => buildLineXml(tipo, g)).join("\n      ");

  const taxPayable = formatarEuroAt(documento.ivaCentavos);
  const netTotal = formatarEuroAt(documento.valorCentavos);
  const grossTotal = formatarEuroAt(documento.valorCentavos + documento.ivaCentavos);

  return `<?xml version="1.0" encoding="UTF-8"?>
<S:Envelope xmlns:S="${AT_SOAP_ENVELOPE_NS}">
  <S:Header>
    <wss:Security xmlns:wss="${AT_WSSE_NS}">
      <wss:UsernameToken>
        <wss:Username>${escapeXml(security.username)}</wss:Username>
        <wss:Password>${escapeXml(security.passwordEnc)}</wss:Password>
        <wss:Nonce>${escapeXml(security.nonceEnc)}</wss:Nonce>
        <wss:Created>${escapeXml(security.createdEnc)}</wss:Created>
      </wss:UsernameToken>
    </wss:Security>
  </S:Header>
  <S:Body>
    <RegisterInvoice xmlns="${ns}">
      <TaxRegistrationNumber>${escapeXml(nifEmitente)}</TaxRegistrationNumber>
      <InvoiceNo>${escapeXml(invoiceNo)}</InvoiceNo>
      <InvoiceDate>${invoiceDate}</InvoiceDate>
      <InvoiceType>${escapeXml(tipo)}</InvoiceType>
      <InvoiceStatus>${status}</InvoiceStatus>
      <CustomerTaxID>${escapeXml(customerTaxId)}</CustomerTaxID>
      ${linesXml}
      <DocumentTotals>
        <TaxPayable>${taxPayable}</TaxPayable>
        <NetTotal>${netTotal}</NetTotal>
        <GrossTotal>${grossTotal}</GrossTotal>
      </DocumentTotals>
    </RegisterInvoice>
  </S:Body>
</S:Envelope>`;
}

/** @deprecated Usar buildRegisterInvoiceSoapEnvelope – mantido para testes legados. */
export function buildAtRegistoSoapEnvelope(
  subutilizador: string,
  documento: AtFaturaDocumentoInput,
): string {
  return buildRegisterInvoiceSoapEnvelope(
    {
      username: subutilizador,
      passwordEnc: "mock-password",
      nonceEnc: "mock-nonce",
      createdEnc: "mock-created",
    },
    documento,
  );
}
