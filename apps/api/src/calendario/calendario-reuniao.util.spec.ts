import { userPodeVerReuniao } from "./calendario-reuniao.util";

const baseRow = {
  criadoPorAutorId: "comercial-a",
  criadoPorUserId: "comercial-a",
  participantesIds: [] as string[],
  audienciaRoles: ["COMERCIAL"] as const,
};

describe("userPodeVerReuniao", () => {
  it("gestor (JWT) vê todas as reuniões", () => {
    expect(
      userPodeVerReuniao(
        { sub: "gestor-1", role: "tenant_manager" },
        null,
        baseRow,
      ),
    ).toBe(true);
  });

  it("comercial criador vê a reunião", () => {
    expect(
      userPodeVerReuniao(
        { sub: "comercial-a", role: "comercial" },
        "COMERCIAL",
        baseRow,
      ),
    ).toBe(true);
  });

  it("outro comercial não vê só por audiência COMERCIAL", () => {
    expect(
      userPodeVerReuniao(
        { sub: "comercial-b", role: "comercial" },
        "COMERCIAL",
        baseRow,
      ),
    ).toBe(false);
  });

  it("participante explícito vê a reunião", () => {
    expect(
      userPodeVerReuniao(
        { sub: "comercial-b", role: "comercial" },
        "COMERCIAL",
        { ...baseRow, participantesIds: ["comercial-b"] },
      ),
    ).toBe(true);
  });
});
