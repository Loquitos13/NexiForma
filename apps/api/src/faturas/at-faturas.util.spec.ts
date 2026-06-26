import {
  agruparLinhasPorTaxa,
  buildAtFaturaPayloadCanonical,
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

  it("agrupa linhas por taxa IVA", () => {
    const grupos = agruparLinhasPorTaxa([
      { descricao: "A", quantidade: 1, precoUnitCentavos: 5000, taxaIva: 23, valorIvaCentavos: 1150 },
      { descricao: "B", quantidade: 1, precoUnitCentavos: 5000, taxaIva: 23, valorIvaCentavos: 1150 },
      { descricao: "C", quantidade: 1, precoUnitCentavos: 2000, taxaIva: 6, valorIvaCentavos: 120 },
    ]);
    expect(grupos).toHaveLength(2);
    expect(grupos[0]?.taxaIva).toBe(6);
    expect(grupos[1]?.baseCentavos).toBe(10000);
  });

  it("gera envelope RegisterInvoice com namespaces AT", () => {
    const xml = buildRegisterInvoiceSoapEnvelope(
      {
        username: "123456789/1",
        passwordEnc: "enc-pwd",
        nonceEnc: "enc-nonce",
        createdEnc: "enc-created",
      },
      sampleDoc,
    );
    expect(xml).toContain("RegisterInvoice");
    expect(xml).toContain("https://servicos.portaldasfinancas.gov.pt/faturas/");
    expect(xml).toContain("<InvoiceStatus>N</InvoiceStatus>");
    expect(xml).toContain("<CreditAmount>100.00</CreditAmount>");
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
