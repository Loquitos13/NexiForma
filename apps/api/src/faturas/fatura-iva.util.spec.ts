import {
  calcularTotaisFatura,
  calcularTotalLiquidoCentavos,
  calcularValorIvaCentavos,
} from "./fatura-iva.util";

describe("fatura-iva.util", () => {
  it("calcula IVA por linha", () => {
    expect(
      calcularValorIvaCentavos({
        quantidade: 2,
        precoUnitCentavos: 5000,
        taxaIva: 23,
      }),
    ).toBe(2300);
  });

  it("calcula totais de fatura", () => {
    const t = calcularTotaisFatura([
      { quantidade: 1, precoUnitCentavos: 10000, taxaIva: 23 },
    ]);
    expect(t.valorCentavos).toBe(10000);
    expect(t.ivaCentavos).toBe(2300);
  });

  it("aplica retenção na fonte ao total líquido", () => {
    expect(calcularTotalLiquidoCentavos(10000, 2300, 1150)).toBe(11150);
    expect(calcularTotalLiquidoCentavos(10000, 2300, 20000)).toBe(0);
  });
});
