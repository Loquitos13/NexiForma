import {
  horasEsperadasModulo,
  minutosSessao,
  validarCronogramaContraCurso,
  type ModuloCursoRef,
} from "./cronograma-validacao-curso.util";

const modPresencial: ModuloCursoRef = {
  id: "m1",
  codigo: "M1",
  titulo: "Introdução",
  cargaHoras: 8,
  cargaHorasTeoricas: 4,
  cargaHorasPraticas: 4,
  metodologia: "presencial",
};

const modBlend: ModuloCursoRef = {
  id: "m2",
  codigo: "M2",
  titulo: "Prática",
  cargaHoras: 10,
  cargaHorasTeoricas: 2,
  cargaHorasPraticas: 8,
  metodologia: "b-learning",
};

describe("cronograma-validacao-curso.util", () => {
  it("minutosSessao calcula duração", () => {
    expect(minutosSessao("09:00", "12:30")).toBe(210);
  });

  it("horasEsperadasModulo usa T+P", () => {
    expect(horasEsperadasModulo(modPresencial)).toBe(8);
  });

  it("detecta módulos do curso sem sessão", () => {
    const r = validarCronogramaContraCurso(
      [
        {
          numeroSessao: 1,
          data: "2026-01-10",
          horaInicio: "09:00",
          horaFim: "13:00",
          modalidade: "presencial",
          moduloUnidadeId: "m1",
          formadorId: null,
        },
      ],
      [modPresencial, modBlend],
    );
    expect(r.modulosSemSessao.length).toBe(1);
    expect(r.requerConfirmacao).toBe(true);
  });

  it("b-learning permite horas síncronas abaixo do total", () => {
    const r = validarCronogramaContraCurso(
      [
        {
          numeroSessao: 1,
          data: "2026-01-10",
          horaInicio: "09:00",
          horaFim: "11:00",
          modalidade: "b-learning",
          moduloUnidadeId: "m2",
          formadorId: null,
        },
      ],
      [modBlend],
    );
    const linha = r.porModulo.find((p) => p.moduloId === "m2");
    expect(linha?.ok).toBe(true);
  });

  it("presencial falha se horas planeadas forem insuficientes", () => {
    const r = validarCronogramaContraCurso(
      [
        {
          numeroSessao: 1,
          data: "2026-01-10",
          horaInicio: "09:00",
          horaFim: "11:00",
          modalidade: "presencial",
          moduloUnidadeId: "m1",
          formadorId: null,
        },
      ],
      [modPresencial],
    );
    const linha = r.porModulo.find((p) => p.moduloId === "m1");
    expect(linha?.ok).toBe(false);
    expect(r.requerConfirmacao).toBe(true);
  });
});
