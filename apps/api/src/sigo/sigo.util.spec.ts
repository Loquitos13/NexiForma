import { parseSigoRemoteStatus } from "./sigo-response.util";

describe("sigo-response.util", () => {
  it("interpreta estado ACEITE", () => {
    const r = parseSigoRemoteStatus({ estado: "ACEITE", mensagem: "OK" });
    expect(r.estado).toBe("ACEITE");
  });

  it("interpreta estado REJEITADA com erros", () => {
    const r = parseSigoRemoteStatus({
      status: "REJEITADA",
      errors: [{ code: "NIF", message: "NIF inválido", field: "formandos[0].nif" }],
    });
    expect(r.estado).toBe("REJEITADA");
    expect(r.erros[0]?.mensagem).toContain("NIF");
  });

  it("interpreta resposta inválida", () => {
    const r = parseSigoRemoteStatus(null);
    expect(r.estado).toBe("ERRO");
  });
});
