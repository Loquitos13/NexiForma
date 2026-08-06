import { isAtLicencaAnexoIiAceite } from "./at-licenca-anexo-ii.util";

describe("isAtLicencaAnexoIiAceite", () => {
  it("false sem aceite", () => {
    expect(isAtLicencaAnexoIiAceite({})).toBe(false);
    expect(isAtLicencaAnexoIiAceite({ atLicencaAceiteEm: null })).toBe(false);
  });

  it("true com aceite e versão actual", () => {
    expect(
      isAtLicencaAnexoIiAceite({
        atLicencaAceiteEm: new Date(),
        atLicencaVersao: "contrato-adesao-ws-anexo-ii-v1",
      }),
    ).toBe(true);
  });

  it("false se versão desactualizada", () => {
    expect(
      isAtLicencaAnexoIiAceite({
        atLicencaAceiteEm: new Date(),
        atLicencaVersao: "antiga",
      }),
    ).toBe(false);
  });
});
