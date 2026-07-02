import {
  agruparLinhasPorTaxa,
  buildAtFaturaPayloadCanonical,
  buildChangeInvoiceStatusSoapEnvelope,
  buildRegisterInvoiceSoapEnvelope,
  hashAtFaturaPayload,
  identificacaoDocumentoAt,
} from "./at-faturas-payload.util";
import {
  buildMockAtSuccessResponse,
  parseAtFaturasSoapResponse,
} from "./at-faturas-response.util";
import {
  desencriptarPasswordWfa,
  encriptarPasswordWfa,
  formatarUsernameWfa,
} from "./at-faturas-credentials.util";
import {
  extrairHashCharacters,
  resolverTaxCodeIva,
  resolverTaxExemptionCode,
} from "./at-tax-codes.util";
import { generateKeyPairSync } from "node:crypto";
import { buildAtSecurityHeaderFields } from "./at-faturas-security.util";

const sampleDoc = {
  nifEmitente: "123456789",
  nifCliente: "987654321",
  tipoDocumento: "FT",
  serie: "2026",
  numero: 42,
  atcud: "ABCD1234-42",
  dataEmissao: new Date("2026-05-29T10:00:00Z"),
  valorCentavos: 10000,
  ivaCentavos: 2300,
  moeda: "EUR",
          hashIntegridade: "dN0mi1g2EmZxFnSM3Z/01Up/1+Ot7rlaBJOLyfgPLAl3q0w4mFIcXwV/ZUQRP+8SPhoU0GqxbEfBEJLt6HMz4YD3hqnBHzxBvETYSK4iKP1euzjE2bSYO179BQBVXcqWEzWM2q028dOa5/ZXeCNHcHPf0xdqxddO8NaZFphwOe8=",
  softwareCertificado: "1234",
  linhas: [
    {
      descricao: "Formação",
      quantidade: 1,
      precoUnitCentavos: 10000,
      taxaIva: 23,
      valorIvaCentavos: 2300,
    },
  ],
};

describe("at-tax-codes.util", () => {
  it("mapeia taxas IVA PT para TaxCode", () => {
    expect(resolverTaxCodeIva(23)).toBe("NOR");
    expect(resolverTaxCodeIva(13)).toBe("INT");
    expect(resolverTaxCodeIva(6)).toBe("RED");
    expect(resolverTaxCodeIva(0)).toBe("ISE");
  });

  it("aplica M07 por defeito em isenção", () => {
    expect(resolverTaxExemptionCode(0)).toBe("M07");
    expect(resolverTaxExemptionCode(23)).toBeNull();
  });

  it("extrai HashCharacters do hash de integridade", () => {
    expect(extrairHashCharacters("a".repeat(64), "1234")).toBe("aaaa");
    expect(extrairHashCharacters(null, "1234")).toBe("0");
  });
});

describe("at-faturas-payload.util", () => {
  it("formata identificação do documento", () => {
    expect(identificacaoDocumentoAt("FT", "2026", 7)).toBe("FT 2026/7");
  });

  it("gera hash estável do payload", () => {
    const h1 = hashAtFaturaPayload(sampleDoc);
    const h2 = hashAtFaturaPayload(sampleDoc);
    expect(h1).toBe(h2);
    expect(h1).toHaveLength(64);
    expect(buildAtFaturaPayloadCanonical(sampleDoc)).toContain('"atcud":"ABCD1234-42"');
  });

  it("agrupa linhas por taxa IVA e motivo isenção", () => {
    const grupos = agruparLinhasPorTaxa([
      { descricao: "A", quantidade: 1, precoUnitCentavos: 5000, taxaIva: 23, valorIvaCentavos: 1150 },
      { descricao: "B", quantidade: 1, precoUnitCentavos: 5000, taxaIva: 23, valorIvaCentavos: 1150 },
      { descricao: "C", quantidade: 1, precoUnitCentavos: 2000, taxaIva: 6, valorIvaCentavos: 120 },
      { descricao: "D", quantidade: 1, precoUnitCentavos: 1000, taxaIva: 0, valorIvaCentavos: 0, codigoMotivoIsencao: "M16" },
    ]);
    expect(grupos).toHaveLength(3);
    expect(grupos.find((g) => g.taxaIva === 0)?.codigoMotivoIsencao).toBe("M16");
  });

  it("gera envelope RegisterInvoiceRequest v3 AT", () => {
    const xml = buildRegisterInvoiceSoapEnvelope(
      {
        username: "123456789/1",
        passwordEnc: "enc-pwd",
        nonceEnc: "enc-nonce",
        createdEnc: "enc-created",
      },
      sampleDoc,
    );
    expect(xml).toContain("RegisterInvoiceRequest");
    expect(xml).toContain("http://factemi.at.min_financas.pt/documents");
    expect(xml).toContain("<doc:InvoiceStatus>N</doc:InvoiceStatus>");
    expect(xml).toContain("<doc:LineSummary>");
    expect(xml).toContain("<doc:TaxCode>NOR</doc:TaxCode>");
    expect(xml).toContain("<doc:PaperLessIndicator>0</doc:PaperLessIndicator>");
    expect(xml).toContain("<doc:ATCUD>ABCD1234-42</doc:ATCUD>");
    expect(xml).not.toContain("TaxExemptionReason");
  });

  it("inclui TaxExemptionCode em linhas isentas", () => {
    const xml = buildRegisterInvoiceSoapEnvelope(
      {
        username: "123456789/1",
        passwordEnc: "enc-pwd",
        nonceEnc: "enc-nonce",
        createdEnc: "enc-created",
      },
      {
        ...sampleDoc,
        valorCentavos: 5000,
        ivaCentavos: 0,
        linhas: [
          {
            descricao: "Isento",
            quantidade: 1,
            precoUnitCentavos: 5000,
            taxaIva: 0,
            valorIvaCentavos: 0,
          },
        ],
      },
    );
    expect(xml).toContain("<doc:TaxExemptionCode>M07</doc:TaxExemptionCode>");
    expect(xml).toContain("<doc:TaxCode>ISE</doc:TaxCode>");
  });

  it("gera ChangeInvoiceStatusRequest para anulação", () => {
    const xml = buildChangeInvoiceStatusSoapEnvelope(
      {
        username: "123456789/1",
        passwordEnc: "enc-pwd",
        nonceEnc: "enc-nonce",
        createdEnc: "enc-created",
      },
      sampleDoc,
      "A",
      new Date("2026-05-30T12:00:00Z"),
    );
    expect(xml).toContain("ChangeInvoiceStatusRequest");
    expect(xml).toContain("<doc:InvoiceStatus>A</doc:InvoiceStatus>");
  });
});

describe("at-faturas-response.util", () => {
  it("interpreta resposta mock de sucesso", () => {
    const xml = buildMockAtSuccessResponse("0");
    const r = parseAtFaturasSoapResponse(xml);
    expect(r.sucesso).toBe(true);
    expect(r.codigoResposta).toBe("0");
  });

  it("interpreta fault SOAP", () => {
    const xml = `<soap:Fault><faultcode>401</faultcode><faultstring>Autenticação inválida</faultstring></soap:Fault>`;
    const r = parseAtFaturasSoapResponse(xml);
    expect(r.sucesso).toBe(false);
    expect(r.mensagemAt).toContain("Autenticação");
  });

  it("mapeia códigos de erro AT", () => {
    const xml = `<?xml version="1.0"?><soap:Envelope><soap:Body><RegisterInvoiceResponse><ReturnCode>-3</ReturnCode></RegisterInvoiceResponse></soap:Body></soap:Envelope>`;
    const r = parseAtFaturasSoapResponse(xml);
    expect(r.sucesso).toBe(false);
    expect(r.mensagemAt).toContain("duplicado");
  });
});

describe("at-faturas-credentials.util", () => {
  it("encripta e desencripta password WFA", () => {
    const enc = encriptarPasswordWfa("segredo-wfa", "test-key-32-chars-minimum!!");
    expect(enc.split(".")).toHaveLength(3);
    expect(desencriptarPasswordWfa(enc, "test-key-32-chars-minimum!!")).toBe("segredo-wfa");
  });

  it("formata username WFA com NIF", () => {
    expect(formatarUsernameWfa("123456789", "1")).toBe("123456789/1");
    expect(formatarUsernameWfa("123456789", "123456789/2")).toBe("123456789/2");
  });
});

describe("at-faturas-security.util", () => {
  it("gera campos WS-Security cifrados", () => {
    const { publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }) as string;
    const fields = buildAtSecurityHeaderFields("123456789/1", "password123", publicKeyPem);
    expect(fields.username).toBe("123456789/1");
    expect(fields.passwordEnc.length).toBeGreaterThan(10);
    expect(fields.nonceEnc.length).toBeGreaterThan(10);
    expect(fields.createdEnc.length).toBeGreaterThan(10);
  });
});
