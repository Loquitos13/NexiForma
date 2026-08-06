import {
  materiaFromTituloModulo,
  planearModulosImport,
  tituloModuloCanonico,
} from "./cronograma-import-ia.util";

describe("import IA módulos", () => {
  it("extrai matéria do título", () => {
    expect(materiaFromTituloModulo("Módulo 1 - Higiene")).toBe("Higiene");
    expect(materiaFromTituloModulo("Qualidade")).toBe("Qualidade");
  });

  it("título canónico", () => {
    expect(tituloModuloCanonico(2, "Higiene")).toBe("Módulo 2 - Higiene");
  });

  it("planeia módulos por ordem cronológica", () => {
    const plan = planearModulosImport([
      {
        data: "2026-08-18",
        horaInicio: "09:00",
        tituloModulo: "Qualidade",
      },
      {
        data: "2026-08-17",
        horaInicio: "11:00",
        tituloModulo: "Higiene",
      },
      {
        data: "2026-08-19",
        horaInicio: "09:00",
        tituloModulo: "Higiene",
      },
    ]);
    expect(plan.map((p) => p.materia)).toEqual(["Higiene", "Qualidade"]);
  });
});
