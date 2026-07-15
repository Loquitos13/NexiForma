import { parseSigoCertificadosList, normalizeSigoNif } from "@nexiforma/shared";

describe("parseSigoCertificadosList", () => {
  it("extrai certificados de array raiz", () => {
    const out = parseSigoCertificadosList([
      { id: "c1", nif: "123456789", estado: "emitido", numeroCertificado: "SIGO-1" },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]?.referencia).toBe("c1");
    expect(out[0]?.nif).toBe("123456789");
    expect(out[0]?.estado).toBe("DISPONIVEL");
    expect(out[0]?.numeroCertificado).toBe("SIGO-1");
  });

  it("extrai certificados de envelope certificados", () => {
    const out = parseSigoCertificadosList({
      certificados: [{ certificadoId: "x", nifFormando: "987654321", status: "pending" }],
    });
    expect(out).toHaveLength(1);
    expect(out[0]?.referencia).toBe("x");
    expect(out[0]?.nif).toBe("987654321");
    expect(out[0]?.estado).toBe("PENDENTE");
  });
});

describe("normalizeSigoNif", () => {
  it("normaliza NIF com espaços", () => {
    expect(normalizeSigoNif("123 456 789")).toBe("123456789");
    expect(normalizeSigoNif("12345")).toBeNull();
  });
});
