import { createHash } from "node:crypto";
import { resolverTaxCodeIva } from "./at-tax-codes.util";
import type { SaftPtFaturaInput } from "./saft-pt-export.util";

export type SaftPtMasterFilesInput = {
  faturas: SaftPtFaturaInput[];
  series: Array<{
    codigo: string;
    tipo: string;
    codigoValidacaoAt: string | null;
    proximoNumero: number;
    estadoAt?: string | null;
  }>;
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function customerIdFromNif(nif: string): string {
  const digits = nif.replace(/\D/g, "").slice(0, 9);
  return digits || "999999990";
}

function productCodeFromDesc(descricao: string, index: number): string {
  const digest = createHash("sha256").update(descricao.trim().toLowerCase()).digest("hex");
  return `P${digest.slice(0, 8).toUpperCase()}`;
}

export function buildSaftPtMasterFilesXml(input: SaftPtMasterFilesInput): string {
  const customersMap = new Map<
    string,
    { id: string; nif: string; nome: string; morada: string | null }
  >();

  for (const f of input.faturas) {
    const id = customerIdFromNif(f.destinatarioNif);
    if (!customersMap.has(id)) {
      customersMap.set(id, {
        id,
        nif: id,
        nome: f.destinatarioNome,
        morada: f.destinatarioMorada ?? null,
      });
    }
  }

  const productsMap = new Map<string, { code: string; desc: string }>();
  for (const f of input.faturas) {
    for (const l of f.linhas) {
      const code = productCodeFromDesc(l.descricao, productsMap.size + 1);
      if (!productsMap.has(code)) {
        productsMap.set(code, { code, desc: l.descricao.slice(0, 200) });
      }
      l.productCode = code;
    }
  }

  const taxRates = new Set<number>();
  for (const f of input.faturas) {
    for (const l of f.linhas) {
      taxRates.add(Number(l.taxaIva));
    }
  }

  const customersXml = [...customersMap.values()]
    .map(
      (c) => `
    <Customer>
      <CustomerID>${escapeXml(c.id)}</CustomerID>
      <AccountID>Desconhecido</AccountID>
      <CustomerTaxID>${escapeXml(c.nif)}</CustomerTaxID>
      <CompanyName>${escapeXml(c.nome.slice(0, 200))}</CompanyName>
      <BillingAddress>
        <AddressDetail>${escapeXml((c.morada ?? "Portugal").slice(0, 200))}</AddressDetail>
        <City>-</City>
        <PostalCode>0000-000</PostalCode>
        <Country>PT</Country>
      </BillingAddress>
      <SelfBillingIndicator>0</SelfBillingIndicator>
    </Customer>`,
    )
    .join("");

  const productsXml = [...productsMap.values()]
    .map(
      (p) => `
    <Product>
      <ProductType>P</ProductType>
      <ProductCode>${escapeXml(p.code)}</ProductCode>
      <ProductDescription>${escapeXml(p.desc)}</ProductDescription>
      <ProductNumberCode>${escapeXml(p.code)}</ProductNumberCode>
    </Product>`,
    )
    .join("");

  const taxEntries = [...taxRates]
    .sort((a, b) => a - b)
    .map((taxa) => {
      const code = resolverTaxCodeIva(taxa);
      const desc =
        taxa <= 0 ? "Isento" : taxa === 6 ? "Taxa reduzida" : taxa === 13 ? "Taxa intermédia" : "Taxa normal";
      return `
    <TaxTableEntry>
      <TaxType>IVA</TaxType>
      <TaxCountryRegion>PT</TaxCountryRegion>
      <TaxCode>${code}</TaxCode>
      <Description>${escapeXml(desc)}</Description>
      <TaxPercentage>${taxa.toFixed(2)}</TaxPercentage>
    </TaxTableEntry>`;
    })
    .join("");

  const taxTableXml =
    taxEntries.length > 0
      ? `<TaxTable>${taxEntries}
  </TaxTable>`
      : "";

  return `<MasterFiles>${customersXml}${productsXml}${taxTableXml}
  </MasterFiles>`;
}

export function resolveProductCodeForLine(descricao: string): string {
  return productCodeFromDesc(descricao, 0);
}
