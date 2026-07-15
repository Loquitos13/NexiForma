import {
  normalizeMoradaOpcional,
  resolveMoradaCarga,
  resolveMoradaDescarga,
} from "./faturacao-moradas.util";

describe("faturacao-moradas.util", () => {
  it("resolve morada de carga com omissão do emitente", () => {
    expect(resolveMoradaCarga(null, "Rua Emitente 1")).toBe("Rua Emitente 1");
    expect(resolveMoradaCarga("  Armazém A ", "Rua Emitente 1")).toBe("Armazém A");
  });

  it("resolve morada de descarga com omissão do cliente", () => {
    expect(resolveMoradaDescarga("", "Rua Cliente 9")).toBe("Rua Cliente 9");
    expect(resolveMoradaDescarga("Obra B", "Rua Cliente 9")).toBe("Obra B");
  });

  it("normaliza morada opcional vazia para null", () => {
    expect(normalizeMoradaOpcional("   ")).toBeNull();
    expect(normalizeMoradaOpcional("Morada X")).toBe("Morada X");
  });
});
