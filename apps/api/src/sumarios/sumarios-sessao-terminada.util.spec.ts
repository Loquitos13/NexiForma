import { sessaoPermiteSumario } from "./sumarios-sessao-terminada.util";

describe("sessaoPermiteSumario", () => {
  it("bloqueia sem terminadaEm", () => {
    expect(sessaoPermiteSumario({ terminadaEm: null })).toBe(false);
    expect(sessaoPermiteSumario({ terminadaEm: undefined })).toBe(false);
  });

  it("permite com terminadaEm", () => {
    expect(sessaoPermiteSumario({ terminadaEm: new Date() })).toBe(true);
    expect(sessaoPermiteSumario({ terminadaEm: "2026-08-04T18:00:00.000Z" })).toBe(true);
  });
});
