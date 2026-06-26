/**
 * Export SAF-T (PT) 1.04_01 - documentos de venda (faturas comerciais).
 * Subconjunto válido para integração contabilística / ERP.
 */

export type SaftPtFaturaInput = {
  id: string;
  numero: number;
  codigoAtcud: string | null;
  estado: string;
  dataEmissao: Date;
  valorCentavos: number;
  ivaCentavos: number;
  destinatarioNome: string;
  destinatarioNif: string;
  serieCodigo: string;
  serieTipo: string;
  linhas: Array<{
    descricao: string;
    quantidade: number;
    precoUnitCentavos: number;
    taxaIva: number;
    valorIvaCentavos: number;
  }>;
};

export type SaftPtExportInput = {
  nifEmitente: string;
  nomeEmpresa: string;
  softwareCertificado: string | null;
  productCompanyTaxId: string;
  periodoInicio: Date;
  periodoFim: Date;
  faturas: SaftPtFaturaInput[];
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function fmtAmount(centavos: number): string {
  return (centavos / 100).toFixed(2);
}

function mapDocumentType(serieTipo: string): string {
  if (serieTipo === "NC") return "NC";
  if (serieTipo === "FS") return "FS";
  return "FT";
}

function mapInvoiceStatus(estado: string): string {
  if (estado === "ANULADA") return "A";
  return "N";
}

export function buildSaftPtXml(input: SaftPtExportInput): string {
  const faturasValidas = input.faturas.filter(
    (f) => f.estado === "EMITIDA" || f.estado === "COMUNICADA_AT" || f.estado === "ANULADA",
  );

  let totalCredit = 0;
  const invoiceNodes = faturasValidas
    .map((f) => {
      const netCentavos = f.valorCentavos - f.ivaCentavos;
      if (f.estado !== "ANULADA") {
        totalCredit += f.valorCentavos;
      }

      const docType = mapDocumentType(f.serieTipo);
      const invoiceNo = `${docType} ${f.serieCodigo}/${f.numero}`;
      const atcud = f.codigoAtcud ?? `${f.serieCodigo}-${f.numero}`;

      const lines = f.linhas
        .map((l, idx) => {
          const lineNet = Math.round(l.quantidade * l.precoUnitCentavos);
          return `
          <Line>
            <LineNumber>${idx + 1}</LineNumber>
            <ProductDescription>${escapeXml(l.descricao.slice(0, 200))}</ProductDescription>
            <Quantity>${l.quantidade.toFixed(4)}</Quantity>
            <UnitPrice>${fmtAmount(l.precoUnitCentavos)}</UnitPrice>
            <TaxPointDate>${fmtDate(f.dataEmissao)}</TaxPointDate>
            <Description>${escapeXml(l.descricao.slice(0, 200))}</Description>
            <CreditAmount>${fmtAmount(lineNet)}</CreditAmount>
            <Tax>
              <TaxType>IVA</TaxType>
              <TaxCountryRegion>PT</TaxCountryRegion>
              <TaxCode>NOR</TaxCode>
              <TaxPercentage>${Number(l.taxaIva).toFixed(2)}</TaxPercentage>
            </Tax>
          </Line>`;
        })
        .join("");

      return `
      <Invoice>
        <InvoiceNo>${escapeXml(invoiceNo)}</InvoiceNo>
        <ATCUD>${escapeXml(atcud)}</ATCUD>
        <DocumentStatus>
          <InvoiceStatus>${mapInvoiceStatus(f.estado)}</InvoiceStatus>
          <InvoiceStatusDate>${fmtDate(f.dataEmissao)}</InvoiceStatusDate>
          <SourceID>NexiForma</SourceID>
          <SourceBilling>P</SourceBilling>
        </DocumentStatus>
        <Hash>${escapeXml(f.id.replace(/-/g, "").slice(0, 172))}</Hash>
        <HashControl>1</HashControl>
        <Period>${String(f.dataEmissao.getMonth() + 1).padStart(2, "0")}</Period>
        <InvoiceDate>${fmtDate(f.dataEmissao)}</InvoiceDate>
        <InvoiceType>${docType}</InvoiceType>
        <SpecialRegimes>
          <SelfBillingIndicator>0</SelfBillingIndicator>
          <CashVATSchemeIndicator>0</CashVATSchemeIndicator>
          <ThirdPartiesBillingIndicator>0</ThirdPartiesBillingIndicator>
        </SpecialRegimes>
        <SourceID>NexiForma</SourceID>
        <SystemEntryDate>${fmtDate(f.dataEmissao)}T12:00:00</SystemEntryDate>
        <CustomerID>${escapeXml(f.destinatarioNif.replace(/\D/g, "").slice(0, 9))}</CustomerID>
        <DocumentTotals>
          <TaxPayable>${fmtAmount(f.ivaCentavos)}</TaxPayable>
          <NetTotal>${fmtAmount(netCentavos)}</NetTotal>
          <GrossTotal>${fmtAmount(f.valorCentavos)}</GrossTotal>
        </DocumentTotals>
        ${lines}
      </Invoice>`;
    })
    .join("");

  const fiscalYear = input.periodoInicio.getFullYear();
  const certNo = input.softwareCertificado?.trim() || "0";

  return `<?xml version="1.0" encoding="UTF-8"?>
<AuditFile xmlns="urn:OECD:StandardAuditFile-Tax:PT_1.04_01">
  <Header>
    <AuditFileVersion>1.04_01</AuditFileVersion>
    <CompanyID>${escapeXml(input.nifEmitente)}</CompanyID>
    <TaxRegistrationNumber>${escapeXml(input.nifEmitente)}</TaxRegistrationNumber>
    <TaxAccountingBasis>F</TaxAccountingBasis>
    <CompanyName>${escapeXml(input.nomeEmpresa)}</CompanyName>
    <CompanyAddress>
      <AddressDetail>Portugal</AddressDetail>
      <City>-</City>
      <PostalCode>0000-000</PostalCode>
      <Country>PT</Country>
    </CompanyAddress>
    <FiscalYear>${fiscalYear}</FiscalYear>
    <StartDate>${fmtDate(input.periodoInicio)}</StartDate>
    <EndDate>${fmtDate(input.periodoFim)}</EndDate>
    <CurrencyCode>EUR</CurrencyCode>
    <DateCreated>${fmtDate(new Date())}</DateCreated>
    <TaxEntity>Global</TaxEntity>
    <ProductCompanyTaxID>${escapeXml(input.productCompanyTaxId)}</ProductCompanyTaxID>
    <SoftwareCertificateNumber>${escapeXml(certNo)}</SoftwareCertificateNumber>
    <ProductID>NexiForma/SAFT</ProductID>
    <ProductVersion>1.0</ProductVersion>
  </Header>
  <SourceDocuments>
    <SalesInvoices>
      <NumberOfEntries>${faturasValidas.length}</NumberOfEntries>
      <TotalDebit>0.00</TotalDebit>
      <TotalCredit>${fmtAmount(totalCredit)}</TotalCredit>
      ${invoiceNodes}
    </SalesInvoices>
  </SourceDocuments>
</AuditFile>`;
}
