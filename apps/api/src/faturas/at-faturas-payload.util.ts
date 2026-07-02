import { createHash } from "node:crypto";
import {
  AT_AUDIT_FILE_VERSION_DEFAULT,
  AT_DOCUMENTS_NS,
  AT_EFATURA_MD_VERSION_DEFAULT,
  AT_SOAP_ENVELOPE_NS,
  AT_WSSE_NS,
} from "./at-faturas-constants";
import type { AtSecurityHeaderFields } from "./at-faturas-security.util";
import {
  extrairHashCharacters,
  resolverDebitCreditIndicator,
  resolverTaxCodeIva,
  resolverTaxExemptionCode,
} from "./at-tax-codes.util";

export type AtInvoiceStatus = "N" | "A" | "F" | "S";

export type AtFaturaLinhaInput = {
  descricao: string;
  quantidade: number;
  precoUnitCentavos: number;
  taxaIva: number;
  valorIvaCentavos: number;
  codigoMotivoIsencao?: string | null;
};

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
  linhas: AtFaturaLinhaInput[];
  hashIntegridade?: string | null;
  softwareCertificado?: string | null;
  systemEntryDate?: Date | null;
  customerTaxIdCountry?: string;
  paperlessIndicator?: 0 | 1;
  selfBillingIndicator?: 0 | 1;
  cashVatSchemeIndicator?: 0 | 1;
  taxEntity?: string;
  retencaoCentavos?: number;
  retencaoTipo?: "IRS" | "IRC" | "IS";
  documentoReferencia?: { tipo: string; serie: string; numero: number } | null;
  eFaturaMDVersion?: string;
  auditFileVersion?: string;
};

export type AtLinhaResumoTaxa = {
  taxaIva: number;
  baseCentavos: number;
  ivaCentavos: number;
  codigoMotivoIsencao: string | null;
};

export type AtPayloadBuildOptions = {
  eFaturaMDVersion?: string;
  auditFileVersion?: string;
};

export function identificacaoDocumentoAt(tipo: string, serie: string, numero: number): string {
  return `${tipo.toUpperCase()} ${serie}/${numero}`;
}

export function formatarEuroAt(centavos: number): string {
  return (centavos / 100).toFixed(2);
}

function formatarDataAt(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatarDateTimeAt(date: Date): string {
  return date.toISOString().slice(0, 19);
}

/** Agrupa linhas por taxa + motivo isenção (spec AT LineSummary). */
export function agruparLinhasPorTaxa(linhas: AtFaturaLinhaInput[]): AtLinhaResumoTaxa[] {
  const map = new Map<string, AtLinhaResumoTaxa>();
  for (const l of linhas) {
    const taxa = Number(l.taxaIva);
    const motivo = resolverTaxExemptionCode(taxa, l.codigoMotivoIsencao);
    const key = `${taxa}|${motivo ?? ""}`;
    const base = Math.round(Number(l.quantidade) * l.precoUnitCentavos);
    const prev = map.get(key) ?? {
      taxaIva: taxa,
      baseCentavos: 0,
      ivaCentavos: 0,
      codigoMotivoIsencao: motivo,
    };
    prev.baseCentavos += base;
    prev.ivaCentavos += l.valorIvaCentavos;
    map.set(key, prev);
  }
  return [...map.values()].sort((a, b) => a.taxaIva - b.taxaIva);
}

export function normalizarNifCliente(nif: string): string {
  const digits = nif.replace(/\D/g, "");
  return digits.length >= 9 ? digits.slice(0, 9) : "999999990";
}

export function buildAtFaturaPayloadCanonical(input: AtFaturaDocumentoInput): string {
  const doc = {
    nifEmitente: input.nifEmitente,
    nifCliente: input.nifCliente,
    tipo: input.tipoDocumento,
    id: identificacaoDocumentoAt(input.tipoDocumento, input.serie, input.numero),
    atcud: input.atcud,
    status: input.invoiceStatus ?? "N",
    data: formatarDataAt(input.dataEmissao),
    base: input.valorCentavos,
    iva: input.ivaCentavos,
    moeda: input.moeda,
    linhas: input.linhas.map((l) => ({
      d: l.descricao.slice(0, 60),
      q: l.quantidade,
      p: l.precoUnitCentavos,
      t: l.taxaIva,
      v: l.valorIvaCentavos,
      m: resolverTaxExemptionCode(l.taxaIva, l.codigoMotivoIsencao),
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

function buildLineSummaryXml(
  grupo: AtLinhaResumoTaxa,
  opts: {
    taxPointDate: string;
    debitCredit: "C" | "D";
    referencia?: string | null;
  },
): string {
  const amount = formatarEuroAt(grupo.baseCentavos);
  const taxCode = resolverTaxCodeIva(grupo.taxaIva);
  const taxPct =
    grupo.taxaIva > 0 ? `<doc:TaxPercentage>${grupo.taxaIva.toFixed(2)}</doc:TaxPercentage>` : "";
  const exemption = grupo.codigoMotivoIsencao
    ? `<doc:TaxExemptionCode>${escapeXml(grupo.codigoMotivoIsencao)}</doc:TaxExemptionCode>`
    : "";
  const reference = opts.referencia
    ? `<doc:Reference>${escapeXml(opts.referencia)}</doc:Reference>`
    : "";

  return `<doc:LineSummary>
        <doc:TaxPointDate>${opts.taxPointDate}</doc:TaxPointDate>
        ${reference}
        <doc:DebitCreditIndicator>${opts.debitCredit}</doc:DebitCreditIndicator>
        <doc:Amount>${amount}</doc:Amount>
        <doc:Tax>
          <doc:TaxType>IVA</doc:TaxType>
          <doc:TaxCountryRegion>PT</doc:TaxCountryRegion>
          <doc:TaxCode>${taxCode}</doc:TaxCode>
          ${taxPct}
          ${exemption}
        </doc:Tax>
      </doc:LineSummary>`;
}

function buildWithholdingXml(documento: AtFaturaDocumentoInput): string {
  const ret = documento.retencaoCentavos ?? 0;
  if (ret <= 0) return "";
  const tipo = documento.retencaoTipo ?? "IRS";
  return `<doc:WithholdingTax>
        <doc:WithholdingTaxType>${tipo}</doc:WithholdingTaxType>
        <doc:WithholdingTaxAmount>${formatarEuroAt(ret)}</doc:WithholdingTaxAmount>
      </doc:WithholdingTax>`;
}

function resolveSoftwareCertNumber(documento: AtFaturaDocumentoInput): string {
  const n = documento.softwareCertificado?.trim();
  if (!n) return "0";
  const digits = n.replace(/\D/g, "");
  return digits || "0";
}

function soapHeader(security: AtSecurityHeaderFields): string {
  return `<S:Header>
    <wss:Security xmlns:wss="${AT_WSSE_NS}">
      <wss:UsernameToken>
        <wss:Username>${escapeXml(security.username)}</wss:Username>
        <wss:Password>${escapeXml(security.passwordEnc)}</wss:Password>
        <wss:Nonce>${escapeXml(security.nonceEnc)}</wss:Nonce>
        <wss:Created>${escapeXml(security.createdEnc)}</wss:Created>
      </wss:UsernameToken>
    </wss:Security>
  </S:Header>`;
}

/**
 * Envelope SOAP RegisterInvoiceRequest – manual AT v3.0 (Comunicação elementos faturação).
 */
export function buildRegisterInvoiceSoapEnvelope(
  security: AtSecurityHeaderFields,
  documento: AtFaturaDocumentoInput,
  buildOpts?: AtPayloadBuildOptions,
): string {
  const doc = AT_DOCUMENTS_NS;
  const tipo = documento.tipoDocumento.toUpperCase();
  const status = documento.invoiceStatus ?? "N";
  const invoiceNo = identificacaoDocumentoAt(tipo, documento.serie, documento.numero);
  const invoiceDate = formatarDataAt(documento.dataEmissao);
  const statusDate = formatarDateTimeAt(documento.systemEntryDate ?? documento.dataEmissao);
  const systemEntry = formatarDateTimeAt(documento.systemEntryDate ?? documento.dataEmissao);
  const customerTaxId = normalizarNifCliente(documento.nifCliente);
  const nifEmitente = documento.nifEmitente.replace(/\D/g, "").slice(0, 9);
  const hashChars = extrairHashCharacters(
    documento.hashIntegridade,
    documento.softwareCertificado,
  );
  const referencia = documento.documentoReferencia
    ? identificacaoDocumentoAt(
        documento.documentoReferencia.tipo,
        documento.documentoReferencia.serie,
        documento.documentoReferencia.numero,
      )
    : null;
  const debitCredit = resolverDebitCreditIndicator(tipo);
  const grupos = agruparLinhasPorTaxa(documento.linhas);
  const linesXml = grupos
    .map((g) =>
      buildLineSummaryXml(g, {
        taxPointDate: invoiceDate,
        debitCredit,
        referencia: tipo === "NC" || tipo === "ND" ? referencia : null,
      }),
    )
    .join("\n      ");

  const mdVersion = buildOpts?.eFaturaMDVersion ?? documento.eFaturaMDVersion ?? AT_EFATURA_MD_VERSION_DEFAULT;
  const auditVersion =
    buildOpts?.auditFileVersion ?? documento.auditFileVersion ?? AT_AUDIT_FILE_VERSION_DEFAULT;

  return `<?xml version="1.0" encoding="UTF-8"?>
<S:Envelope xmlns:S="${AT_SOAP_ENVELOPE_NS}">
  ${soapHeader(security)}
  <S:Body>
    <doc:RegisterInvoiceRequest xmlns:doc="${doc}">
      <doc:eFaturaMDVersion>${escapeXml(mdVersion)}</doc:eFaturaMDVersion>
      <doc:AuditFileVersion>${escapeXml(auditVersion)}</doc:AuditFileVersion>
      <doc:TaxRegistrationNumber>${escapeXml(nifEmitente)}</doc:TaxRegistrationNumber>
      <doc:TaxEntity>${escapeXml(documento.taxEntity ?? "Global")}</doc:TaxEntity>
      <doc:SoftwareCertificateNumber>${resolveSoftwareCertNumber(documento)}</doc:SoftwareCertificateNumber>
      <doc:InvoiceData>
        <doc:InvoiceNo>${escapeXml(invoiceNo)}</doc:InvoiceNo>
        <doc:ATCUD>${escapeXml(documento.atcud)}</doc:ATCUD>
        <doc:InvoiceDate>${invoiceDate}</doc:InvoiceDate>
        <doc:InvoiceType>${escapeXml(tipo)}</doc:InvoiceType>
        <doc:SelfBillingIndicator>${documento.selfBillingIndicator ?? 0}</doc:SelfBillingIndicator>
        <doc:CustomerTaxID>${escapeXml(customerTaxId)}</doc:CustomerTaxID>
        <doc:CustomerTaxIDCountry>${escapeXml(documento.customerTaxIdCountry ?? "PT")}</doc:CustomerTaxIDCountry>
        <doc:DocumentStatus>
          <doc:InvoiceStatus>${status}</doc:InvoiceStatus>
          <doc:InvoiceStatusDate>${statusDate}</doc:InvoiceStatusDate>
        </doc:DocumentStatus>
        <doc:HashCharacters>${escapeXml(hashChars)}</doc:HashCharacters>
        <doc:CashVATSchemeIndicator>${documento.cashVatSchemeIndicator ?? 0}</doc:CashVATSchemeIndicator>
        <doc:PaperLessIndicator>${documento.paperlessIndicator ?? 0}</doc:PaperLessIndicator>
        <doc:SystemEntryDate>${systemEntry}</doc:SystemEntryDate>
        ${linesXml}
        <doc:DocumentTotals>
          <doc:TaxPayable>${formatarEuroAt(documento.ivaCentavos)}</doc:TaxPayable>
          <doc:NetTotal>${formatarEuroAt(documento.valorCentavos)}</doc:NetTotal>
          <doc:GrossTotal>${formatarEuroAt(documento.valorCentavos + documento.ivaCentavos)}</doc:GrossTotal>
        </doc:DocumentTotals>
        ${buildWithholdingXml(documento)}
      </doc:InvoiceData>
    </doc:RegisterInvoiceRequest>
  </S:Body>
</S:Envelope>`;
}

/** Alteração de estado (anulação) – ChangeInvoiceStatusRequest. */
export function buildChangeInvoiceStatusSoapEnvelope(
  security: AtSecurityHeaderFields,
  documento: AtFaturaDocumentoInput,
  novoEstado: Exclude<AtInvoiceStatus, "N">,
  statusDate: Date,
  buildOpts?: AtPayloadBuildOptions,
): string {
  const doc = AT_DOCUMENTS_NS;
  const tipo = documento.tipoDocumento.toUpperCase();
  const invoiceNo = identificacaoDocumentoAt(tipo, documento.serie, documento.numero);
  const invoiceDate = formatarDataAt(documento.dataEmissao);
  const nifEmitente = documento.nifEmitente.replace(/\D/g, "").slice(0, 9);
  const customerTaxId = normalizarNifCliente(documento.nifCliente);
  const mdVersion = buildOpts?.eFaturaMDVersion ?? documento.eFaturaMDVersion ?? AT_EFATURA_MD_VERSION_DEFAULT;

  return `<?xml version="1.0" encoding="UTF-8"?>
<S:Envelope xmlns:S="${AT_SOAP_ENVELOPE_NS}">
  ${soapHeader(security)}
  <S:Body>
    <doc:ChangeInvoiceStatusRequest xmlns:doc="${doc}">
      <doc:eFaturaMDVersion>${escapeXml(mdVersion)}</doc:eFaturaMDVersion>
      <doc:TaxRegistrationNumber>${escapeXml(nifEmitente)}</doc:TaxRegistrationNumber>
      <doc:InvoiceHeader>
        <doc:InvoiceNo>${escapeXml(invoiceNo)}</doc:InvoiceNo>
        <doc:ATCUD>${escapeXml(documento.atcud)}</doc:ATCUD>
        <doc:InvoiceDate>${invoiceDate}</doc:InvoiceDate>
        <doc:InvoiceType>${escapeXml(tipo)}</doc:InvoiceType>
        <doc:SelfBillingIndicator>${documento.selfBillingIndicator ?? 0}</doc:SelfBillingIndicator>
        <doc:CustomerTaxID>${escapeXml(customerTaxId)}</doc:CustomerTaxID>
        <doc:CustomerTaxIDCountry>${escapeXml(documento.customerTaxIdCountry ?? "PT")}</doc:CustomerTaxIDCountry>
      </doc:InvoiceHeader>
      <doc:InvoiceStatus>
        <doc:InvoiceStatus>${novoEstado}</doc:InvoiceStatus>
        <doc:InvoiceStatusDate>${formatarDateTimeAt(statusDate)}</doc:InvoiceStatusDate>
      </doc:InvoiceStatus>
    </doc:ChangeInvoiceStatusRequest>
  </S:Body>
</S:Envelope>`;
}

/** @deprecated Usar buildRegisterInvoiceSoapEnvelope. */
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
