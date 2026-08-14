import {
  isEntidadeClienteConfirmada,
  mergeRegistoClienteMeta,
  readRegistoClienteMeta,
  resolveRegistoClienteStatus,
} from "./entidade-cliente-registo.util";

describe("entidade-cliente-registo.util", () => {
  it("trata metadata vazia como cliente confirmado", () => {
    expect(resolveRegistoClienteStatus(null)).toBe("cliente");
    expect(isEntidadeClienteConfirmada(undefined)).toBe(true);
  });

  it("lê e actualiza status de registo", () => {
    const meta = mergeRegistoClienteMeta(null, { status: "prospecto" });
    expect(readRegistoClienteMeta(meta)?.status).toBe("prospecto");
    expect(isEntidadeClienteConfirmada(meta)).toBe(false);

    const pendente = mergeRegistoClienteMeta(meta, {
      status: "pendente_completar",
      propostaAceiteId: "p1",
    });
    expect(resolveRegistoClienteStatus(pendente)).toBe("pendente_completar");

    const cliente = mergeRegistoClienteMeta(pendente, {
      status: "cliente",
      completadoEm: "2026-01-01T00:00:00.000Z",
    });
    expect(isEntidadeClienteConfirmada(cliente)).toBe(true);
  });
});
