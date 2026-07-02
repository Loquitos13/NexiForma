/**

 * Export SAF-T (PT) 1.04_01 – faturação (TaxAccountingBasis F).

 * Inclui MasterFiles (clientes, produtos, taxas) + SalesInvoices.

 */



import {

  resolverTaxCodeIva,

  resolverTaxExemptionCode,

} from "./at-tax-codes.util";

import { formatarAtSystemEntryDate } from "./fatura-assinatura-at.util";

import { buildSaftPtMasterFilesXml } from "./saft-pt-master-files.util";



export type SaftPtFaturaInput = {

  id: string;

  numero: number;

  codigoAtcud: string | null;

  estado: string;

  dataEmissao: Date;

  valorCentavos: number;

  ivaCentavos: number;

  retencaoCentavos?: number;

  hashIntegridade: string | null;

  hashControl: string | null;

  destinatarioNome: string;

  destinatarioNif: string;

  destinatarioMorada?: string | null;

  serieCodigo: string;

  serieTipo: string;

  documentoReferencia?: string | null;

  linhas: Array<{

    descricao: string;

    quantidade: number;

    precoUnitCentavos: number;

    taxaIva: number;

    valorIvaCentavos: number;

    codigoIsencaoIva?: string | null;

    productCode?: string;

  }>;

};



export type SaftPtSerieInput = {

  codigo: string;

  tipo: string;

  codigoValidacaoAt: string | null;

  proximoNumero: number;

  estadoAt?: string | null;

};



export type SaftPtExportInput = {

  nifEmitente: string;

  nomeEmpresa: string;

  moradaFiscal?: string | null;

  softwareCertificado: string | null;

  productCompanyTaxId: string;

  productId?: string;

  productVersion?: string;

  periodoInicio: Date;

  periodoFim: Date;

  faturas: SaftPtFaturaInput[];

  series?: SaftPtSerieInput[];

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



function parseMoradaFiscal(morada: string | null | undefined): {

  detail: string;

  city: string;

  postalCode: string;

} {

  const raw = morada?.trim();

  if (!raw) {

    return { detail: "Portugal", city: "-", postalCode: "0000-000" };

  }

  const postalMatch = raw.match(/\b(\d{4}-\d{3})\b/);

  return {

    detail: raw.slice(0, 200),

    city: "-",

    postalCode: postalMatch?.[1] ?? "0000-000",

  };

}



export function buildSaftPtXml(input: SaftPtExportInput): string {

  const faturasValidas = input.faturas.filter(

    (f) => f.estado === "EMITIDA" || f.estado === "COMUNICADA_AT" || f.estado === "ANULADA",

  );



  const masterFilesXml = buildSaftPtMasterFilesXml({

    faturas: faturasValidas,

    series: input.series ?? [],

  });



  let totalCredit = 0;

  let totalDebit = 0;



  const invoiceNodes = faturasValidas

    .map((f) => {

      const netCentavos = f.valorCentavos;

      const grossCentavos = f.valorCentavos + f.ivaCentavos;

      const docType = mapDocumentType(f.serieTipo);

      const isDebitDoc = docType === "NC" || docType === "ND";



      if (f.estado !== "ANULADA") {

        if (isDebitDoc) totalDebit += grossCentavos;

        else totalCredit += grossCentavos;

      }



      const invoiceNo = `${docType} ${f.serieCodigo}/${f.numero}`;

      const atcud = f.codigoAtcud ?? `${f.serieCodigo}-${f.numero}`;

      const hash = f.hashIntegridade?.trim() ?? "";

      const hashControl = f.hashControl?.trim() || "1";

      const customerId = f.destinatarioNif.replace(/\D/g, "").slice(0, 9) || "999999990";



      const lines = f.linhas

        .map((l, idx) => {

          const lineNet = Math.round(l.quantidade * l.precoUnitCentavos);

          const taxCode = resolverTaxCodeIva(Number(l.taxaIva));

          const exemption = resolverTaxExemptionCode(Number(l.taxaIva), l.codigoIsencaoIva);

          const exemptionNode = exemption

            ? `\n              <TaxExemptionCode>${exemption}</TaxExemptionCode>`

            : "";

          const productCode = l.productCode ?? `P${String(idx + 1).padStart(4, "0")}`;

          const amountTag = isDebitDoc ? "DebitAmount" : "CreditAmount";

          const refNode =

            isDebitDoc && f.documentoReferencia

              ? `

            <References>

              <Reference>${escapeXml(f.documentoReferencia)}</Reference>

              <Reason>Nota de crédito</Reason>

            </References>`

              : "";



          return `

          <Line>

            <LineNumber>${idx + 1}</LineNumber>

            <ProductCode>${escapeXml(productCode)}</ProductCode>

            <ProductDescription>${escapeXml(l.descricao.slice(0, 200))}</ProductDescription>

            <Quantity>${l.quantidade.toFixed(4)}</Quantity>

            <UnitOfMeasure>UN</UnitOfMeasure>

            <UnitPrice>${fmtAmount(l.precoUnitCentavos)}</UnitPrice>

            <TaxPointDate>${fmtDate(f.dataEmissao)}</TaxPointDate>${refNode}

            <Description>${escapeXml(l.descricao.slice(0, 200))}</Description>

            <${amountTag}>${fmtAmount(lineNet)}</${amountTag}>

            <Tax>

              <TaxType>IVA</TaxType>

              <TaxCountryRegion>PT</TaxCountryRegion>

              <TaxCode>${taxCode}</TaxCode>

              <TaxPercentage>${Number(l.taxaIva).toFixed(2)}</TaxPercentage>${exemptionNode}

            </Tax>

          </Line>`;

        })

        .join("");



      const retencao = f.retencaoCentavos ?? 0;

      const retencaoNode =

        retencao > 0

          ? `\n          <WithholdingTaxAmount>${fmtAmount(retencao)}</WithholdingTaxAmount>`

          : "";



      return `

      <Invoice>

        <InvoiceNo>${escapeXml(invoiceNo)}</InvoiceNo>

        <ATCUD>${escapeXml(atcud)}</ATCUD>

        <DocumentStatus>

          <InvoiceStatus>${mapInvoiceStatus(f.estado)}</InvoiceStatus>

          <InvoiceStatusDate>${formatarAtSystemEntryDate(f.dataEmissao)}</InvoiceStatusDate>

          <SourceID>NexiForma</SourceID>

          <SourceBilling>P</SourceBilling>

        </DocumentStatus>

        <Hash>${escapeXml(hash)}</Hash>

        <HashControl>${escapeXml(hashControl)}</HashControl>

        <Period>${String(f.dataEmissao.getUTCMonth() + 1).padStart(2, "0")}</Period>

        <InvoiceDate>${fmtDate(f.dataEmissao)}</InvoiceDate>

        <InvoiceType>${docType}</InvoiceType>

        <SpecialRegimes>

          <SelfBillingIndicator>0</SelfBillingIndicator>

          <CashVATSchemeIndicator>0</CashVATSchemeIndicator>

          <ThirdPartiesBillingIndicator>0</ThirdPartiesBillingIndicator>

        </SpecialRegimes>

        <SourceID>NexiForma</SourceID>

        <SystemEntryDate>${formatarAtSystemEntryDate(f.dataEmissao)}</SystemEntryDate>

        <CustomerID>${escapeXml(customerId)}</CustomerID>

        <DocumentTotals>

          <TaxPayable>${fmtAmount(f.ivaCentavos)}</TaxPayable>

          <NetTotal>${fmtAmount(netCentavos)}</NetTotal>

          <GrossTotal>${fmtAmount(grossCentavos)}</GrossTotal>${retencaoNode}

        </DocumentTotals>

        ${lines}

      </Invoice>`;

    })

    .join("");



  const fiscalYear = input.periodoInicio.getFullYear();

  const certNo = input.softwareCertificado?.trim() || "0";

  const morada = parseMoradaFiscal(input.moradaFiscal);



  return `<?xml version="1.0" encoding="UTF-8"?>

<AuditFile xmlns="urn:OECD:StandardAuditFile-Tax:PT_1.04_01">

  <Header>

    <AuditFileVersion>1.04_01</AuditFileVersion>

    <CompanyID>${escapeXml(input.nifEmitente)}</CompanyID>

    <TaxRegistrationNumber>${escapeXml(input.nifEmitente)}</TaxRegistrationNumber>

    <TaxAccountingBasis>F</TaxAccountingBasis>

    <CompanyName>${escapeXml(input.nomeEmpresa)}</CompanyName>

    <CompanyAddress>

      <AddressDetail>${escapeXml(morada.detail)}</AddressDetail>

      <City>${escapeXml(morada.city)}</City>

      <PostalCode>${escapeXml(morada.postalCode)}</PostalCode>

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

    <ProductID>${escapeXml(input.productId ?? "NexiForma/SAFT")}</ProductID>

    <ProductVersion>${escapeXml(input.productVersion ?? "1.0")}</ProductVersion>

  </Header>

  ${masterFilesXml}

  <SourceDocuments>

    <SalesInvoices>

      <NumberOfEntries>${faturasValidas.length}</NumberOfEntries>

      <TotalDebit>${fmtAmount(totalDebit)}</TotalDebit>

      <TotalCredit>${fmtAmount(totalCredit)}</TotalCredit>

      ${invoiceNodes}

    </SalesInvoices>

  </SourceDocuments>

</AuditFile>`;

}


