import { normalizeCursoCodigoUfcd } from "./cursos-ufcd.util";

describe("normalizeCursoCodigoUfcd", () => {
  it("null para vazio", () => {
    expect(normalizeCursoCodigoUfcd(undefined)).toBeNull();
    expect(normalizeCursoCodigoUfcd("")).toBeNull();
    expect(normalizeCursoCodigoUfcd("   ")).toBeNull();
  });

  it("trim do código", () => {
    expect(normalizeCursoCodigoUfcd(" 7834 ")).toBe("7834");
  });
});
