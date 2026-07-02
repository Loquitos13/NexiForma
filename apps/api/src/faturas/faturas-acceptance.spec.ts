/**
 * Critérios de aceitação Fase 10B – validação unitária dos building blocks.
 */
import { formatarAtcud } from "./fatura-atcud.util";
import { calcularTotalLiquidoCentavos, calcularTotaisFatura } from "./fatura-iva.util";
import {
  buildMockAtSuccessResponse,
  parseAtFaturasSoapResponse,
} from "./at-faturas-response.util";
import { avaliarCertificacaoAt } from "./at-certificacao.util";

describe("Critérios aceitação 10B (unitários)", () => {
  it("CA-3: emissão gera ATCUD válido para QR/documento", () => {
    expect(formatarAtcud("ABCD1234", 42)).toBe("ABCD1234-42");
  });

  it("CA-4: comunicação AT regista sucesso com mensagem legível", () => {
    const r = parseAtFaturasSoapResponse(buildMockAtSuccessResponse("0"));
    expect(r.sucesso).toBe(true);
    expect(r.mensagemAt).toBeTruthy();
  });

  it("CA-4: comunicação AT regista erro com mensagem legível", () => {
    const xml = `<?xml version="1.0"?><soap:Envelope><soap:Body><RegisterInvoiceResponse><ReturnCode>-3</ReturnCode></RegisterInvoiceResponse></soap:Body></soap:Envelope>`;
    const r = parseAtFaturasSoapResponse(xml);
    expect(r.sucesso).toBe(false);
    expect(r.mensagemAt).toMatch(/duplicado/i);
  });

  it("CA-7: cálculo IVA e retenções", () => {
    const { valorCentavos, ivaCentavos } = calcularTotaisFatura([
      { quantidade: 1, precoUnitCentavos: 10000, taxaIva: 23 },
    ]);
    expect(calcularTotalLiquidoCentavos(valorCentavos, ivaCentavos, 500)).toBe(
      valorCentavos + ivaCentavos - 500,
    );
  });

  it("CA-2: gestor vê estado integração AT em sandbox", () => {
    const cert = avaliarCertificacaoAt({
      config: {
        nomeEmpresa: "Teste Lda",
        nifEmitente: "123456789",
        moradaFiscal: "Rua A",
        atSubutilizador: "1",
        atWfaPasswordEnc: "enc",
        atCertificadoRef: null,
        softwareCertificado: null,
        comunicacaoAtiva: true,
      },
      series: [{ codigo: "2026", tipo: "FT", codigoValidacaoAt: null }],
      softwarePlataforma: null,
      modoServidor: "sandbox",
    });
    expect(cert.modoServidor).toBe("sandbox");
    expect(cert.prontaSandbox).toBe(true);
  });
});
