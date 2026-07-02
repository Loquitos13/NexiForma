import { buildFaturaSearchOr, parseEurosPesquisaCentavos } from "./fatura-search.util";

describe("fatura-search.util", () => {
  it("parseEurosPesquisaCentavos", () => {
    expect(parseEurosPesquisaCentavos("2000")).toBe(200000);
    expect(parseEurosPesquisaCentavos("2000,50")).toBe(200050);
    expect(parseEurosPesquisaCentavos("5")).toBe(500);
    expect(parseEurosPesquisaCentavos("abc")).toBeNull();
  });

  it("pesquisa NIF desde o primeiro dígito", () => {
    const or = buildFaturaSearchOr("5");
    expect(or.some((c) => "destinatarioNif" in c)).toBe(true);
    expect(or.some((c) => "destinatarioNome" in c)).toBe(false);
  });

  it("buildFaturaSearchOr inclui ref fatura", () => {
    const ref = buildFaturaSearchOr("2026/2");
    expect(ref.some((c) => "AND" in c)).toBe(true);
  });
});
