import {
  avaliarCertificacaoAt,
  resolverSoftwareCertificado,
} from "./at-certificacao.util";
import {
  buildFaturaIntegridadeCanonical,
  hashIntegridadeFatura,
} from "./fatura-integridade.util";

describe("at-certificacao.util", () => {
  it("resolve certificado tenant antes da plataforma", () => {
    expect(resolverSoftwareCertificado("TEN-1", "PLAT-1")).toEqual({
      numero: "TEN-1",
      origem: "tenant",
    });
    expect(resolverSoftwareCertificado(null, "PLAT-1")).toEqual({
      numero: "PLAT-1",
      origem: "plataforma",
    });
    expect(resolverSoftwareCertificado("", "")).toEqual({ numero: null, origem: null });
  });

  it("marca prontidão quando requisitos bloqueantes ok", () => {
    const r = avaliarCertificacaoAt({
      config: {
        nomeEmpresa: "Empresa",
        nifEmitente: "123456789",
        moradaFiscal: "Rua X",
        iban: "PT50000201231234567890154",
        bicSwift: "BBPIPTPL",
        emailGestor: "gestor@empresa.pt",
        capitalSocial: "5000 EUR",
        consRegCom: "123456789",
        atSubutilizador: "wfa-user",
        atWfaPasswordEnc: "enc",
        atCertificadoRef: null,
        softwareCertificado: "SW-999",
        comunicacaoAtiva: false,
      },
      series: [{ codigo: "2026", tipo: "FT", codigoValidacaoAt: "ABCD1234" }],
      softwarePlataforma: null,
      modoServidor: "production",
    });
    expect(r.prontaProducao).toBe(true);
    expect(r.items.find((i) => i.id === "software_certificado")?.ok).toBe(true);
  });

  it("marca prontidão sandbox com dados mínimos", () => {
    const r = avaliarCertificacaoAt({
      config: {
        nomeEmpresa: "Empresa",
        nifEmitente: "123456789",
        moradaFiscal: null,
        atSubutilizador: null,
        atWfaPasswordEnc: null,
        atCertificadoRef: null,
        softwareCertificado: null,
        comunicacaoAtiva: false,
      },
      series: [],
      softwarePlataforma: null,
      modoServidor: "sandbox",
    });
    expect(r.prontaSandbox).toBe(true);
    expect(r.prontaProducao).toBe(false);
    expect(r.modoServidor).toBe("sandbox");
  });

  it("falha prontidão sem certificado em produção", () => {
    const r = avaliarCertificacaoAt({
      config: {
        nomeEmpresa: "Empresa",
        nifEmitente: "123456789",
        moradaFiscal: "Rua X",
        atSubutilizador: "wfa-user",
        atWfaPasswordEnc: "enc",
        atCertificadoRef: null,
        softwareCertificado: null,
        comunicacaoAtiva: true,
      },
      series: [{ codigo: "2026", tipo: "FT", codigoValidacaoAt: null }],
      softwarePlataforma: null,
      modoServidor: "production",
    });
    expect(r.prontaProducao).toBe(false);
  });
});

describe("fatura-integridade.util", () => {
  const sample = {
    tenantId: "t1",
    faturaId: "f1",
    nifEmitente: "123456789",
    destinatarioNif: "987654321",
    tipoDocumento: "FT",
    serie: "2026",
    numero: 1,
    atcud: "ABCD1234-1",
    dataEmissao: new Date("2026-05-29T12:00:00Z"),
    valorCentavos: 10000,
    ivaCentavos: 2300,
    moeda: "EUR",
    softwareCertificado: "SW-1",
    linhas: [
      {
        ordem: 1,
        descricao: "Formação",
        quantidade: 1,
        precoUnitCentavos: 10000,
        taxaIva: 23,
        valorIvaCentavos: 2300,
      },
    ],
  };

  it("gera hash estável de 64 caracteres", () => {
    const h1 = hashIntegridadeFatura(sample);
    const h2 = hashIntegridadeFatura(sample);
    expect(h1).toBe(h2);
    expect(h1).toHaveLength(64);
    expect(buildFaturaIntegridadeCanonical(sample)).toContain('"atcud":"ABCD1234-1"');
  });
});
