import { listFeriadosNacionaisPt } from "./feriados-nacionais.util";

describe("listFeriadosNacionaisPt", () => {
  it("devolve feriados PT no intervalo (fallback local se API falhar)", async () => {
    const start = new Date("2026-01-01T00:00:00.000Z");
    const end = new Date("2026-01-31T23:59:59.999Z");
    const items = await listFeriadosNacionaisPt(start, end);
    expect(items.some((f) => f.date === "2026-01-01")).toBe(true);
    expect(items.every((f) => f.date.startsWith("2026-01"))).toBe(true);
  });
});
