import {
  parseAlvoRoles,
  parseAlvoUserIds,
  userPodeEditarCalendarioEvento,
  userPodeVerCalendarioEvento,
} from "./calendario-notas.util";

describe("calendario-notas.util", () => {
  const gestor = { sub: "u1", role: "tenant_manager" as const };
  const comercial = { sub: "u2", role: "comercial" as const };
  const formando = { sub: "u3", role: "formando" as const };

  it("gestor vê qualquer evento", () => {
    expect(
      userPodeVerCalendarioEvento(
        gestor,
        "ADMIN",
        { criadoPorUserId: "x", alvoUserIds: [], alvoRoles: [] },
      ),
    ).toBe(true);
  });

  it("alvo individual vê evento atribuído", () => {
    expect(
      userPodeVerCalendarioEvento(
        formando,
        "FORMANDO",
        { criadoPorUserId: "x", alvoUserIds: ["u3"], alvoRoles: [] },
      ),
    ).toBe(true);
  });

  it("membro do grupo vê evento atribuído ao role", () => {
    expect(
      userPodeVerCalendarioEvento(
        comercial,
        "COMERCIAL",
        { criadoPorUserId: "x", alvoUserIds: [], alvoRoles: ["COMERCIAL"] },
      ),
    ).toBe(true);
  });

  it("utilizador externo não vê evento privado", () => {
    expect(
      userPodeVerCalendarioEvento(
        comercial,
        "COMERCIAL",
        { criadoPorUserId: "x", alvoUserIds: [], alvoRoles: [] },
      ),
    ).toBe(false);
  });

  it("criador pode editar", () => {
    expect(
      userPodeEditarCalendarioEvento(comercial, { criadoPorUserId: "u2" }),
    ).toBe(true);
  });

  it("parseAlvoUserIds filtra inválidos", () => {
    expect(parseAlvoUserIds(["a", 1, "b"])).toEqual(["a", "b"]);
  });

  it("parseAlvoRoles filtra inválidos", () => {
    expect(parseAlvoRoles(["COMERCIAL", "INVALIDO", "FORMANDO"])).toEqual([
      "COMERCIAL",
      "FORMANDO",
    ]);
  });
});
