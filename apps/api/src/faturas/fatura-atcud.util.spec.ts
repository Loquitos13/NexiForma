import { buildFaturaQrPayload } from "./fatura-atcud.util";

describe("fatura-atcud.util", () => {
  const baseInput = {
    nifEmitente: "123456789",
    nifCliente: "999999990",
    tipoDocumento: "FT",
    dataEmissao: new Date("2019-08-12T10:00:00Z"),
    identificacaoDocumento: "FT CDVF/12345",
    atcud: "CDF7T5HD-12345",
    totalSemIvaCentavos: 65,
    totalIvaCentavos: 15,
    hashIntegridade:
      "wh0uUgI/fLTt9Kpb/hFwN6VIkjWZWI8R2TxtHUMyRL0a7hyQLIvoxuqGzKfzUfvAV3E1gxpKZtai5qli6Nx7unqzC4vIoc6rtb3ObuxifXiBAUD95BMh31T73O6cgcwhGR0YhiV/E6jfCbihJL2B/2s+/qsaL7OY/bU651c3va0=",
    softwareCertificado: "9999",
  };

  it("QR inclui N=impostos, O=total com impostos, Q=hash e R=certificado", () => {
    const payload = buildFaturaQrPayload(baseInput);
    expect(payload).toContain("N:0.15");
    expect(payload).toContain("O:0.80");
    expect(payload).toContain("Q:wTN8");
    expect(payload).toContain("R:9999");
    expect(payload.split("*")).toEqual(
      expect.arrayContaining([
        "A:123456789",
        "H:CDF7T5HD-12345",
        "N:0.15",
        "O:0.80",
        "Q:wTN8",
        "R:9999",
      ]),
    );
  });
});
