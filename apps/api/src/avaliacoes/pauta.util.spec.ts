import { moduloIdFromPautaTipo, pautaTipo } from "./pauta.util";

describe("pauta.util", () => {
  it("monta e extrai tipo pauta", () => {
    const id = "21c11430-495b-4e69-8ebf-b3ccd5f6a304";
    expect(pautaTipo(id)).toBe(`pauta:${id}`);
    expect(moduloIdFromPautaTipo(`pauta:${id}`)).toBe(id);
    expect(moduloIdFromPautaTipo("FINAL")).toBeNull();
  });
});
