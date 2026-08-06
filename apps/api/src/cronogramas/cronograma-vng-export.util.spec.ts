import {
  buildVngColumns,
  buildVngFaixas,
  buildVngLegenda,
  buildVngMonthSpans,
  extractModuloNums,
  moduloIdsCoveredBySessao,
  normalizeHora,
  resolveCelulaCodigo,
} from "./cronograma-vng-export.util";

const modulos = [
  { id: "m1", codigo: "M1", titulo: "Módulo 1", ordem: 0 },
  { id: "m2", codigo: "M2", titulo: "Módulo 2", ordem: 1 },
  { id: "m5", codigo: "M5", titulo: "Módulo 5", ordem: 4 },
  { id: "m6", codigo: "M6", titulo: "Módulo 6", ordem: 5 },
  { id: "m7", codigo: "M7", titulo: "Módulo 7", ordem: 6 },
  { id: "m8", codigo: "M8", titulo: "Módulo 8", ordem: 7 },
];

describe("cronograma-vng-export.util", () => {
  it("extrai números de título plural", () => {
    expect(extractModuloNums("Aula Presencial dos Módulos 5 e 6")).toEqual([5, 6]);
  });

  it("normaliza horas para fundir faixas", () => {
    expect(normalizeHora("9:00")).toBe("09:00");
    expect(normalizeHora("09:00:00")).toBe("09:00");
  });

  it("resolve código agrupado M5/M6 e ids cobertos", () => {
    const sessao = {
      data: "2026-09-02",
      horaInicio: "09:00",
      horaFim: "13:00",
      modalidade: "presencial",
      titulo: "Aula Presencial dos Módulos 5 e 6",
      numeroSessao: 5,
      modulo: modulos[2],
    };
    expect(resolveCelulaCodigo(sessao, modulos)).toBe("M5/M6");
    expect(moduloIdsCoveredBySessao(sessao, modulos)).toEqual(["m5", "m6"]);
  });

  it("buildVngColumns e month spans", () => {
    const cols = buildVngColumns("2026-08-30", "2026-09-02");
    expect(cols.map((c) => c.day)).toEqual([30, 31, 1, 2]);
    expect(buildVngMonthSpans(cols)).toEqual([
      { label: "Agosto 2026", colSpan: 2 },
      { label: "Setembro 2026", colSpan: 2 },
    ]);
  });

  it("auto preenche do dia da sessão até ao prazo; prazo a vermelho", () => {
    const sessoes = [
      {
        data: "2026-08-17",
        horaInicio: "11:00",
        horaFim: "13:00",
        modalidade: "presencial",
        titulo: "Aula Presencial do Módulo 1",
        numeroSessao: 1,
        modulo: modulos[0],
      },
      {
        data: "2026-08-24",
        horaInicio: "09:00:00",
        horaFim: "13:00:00",
        modalidade: "presencial",
        titulo: "Aula Presencial do Módulo 2",
        numeroSessao: 2,
        modulo: modulos[1],
      },
      {
        data: "2026-08-25",
        horaInicio: "9:00",
        horaFim: "13:00",
        modalidade: "presencial",
        titulo: "Outra no mesmo horário",
        numeroSessao: 3,
        modulo: modulos[1],
      },
      {
        data: "2026-09-04",
        horaInicio: "10:00",
        horaFim: "11:30",
        modalidade: "b-learning",
        titulo: "Sessão Síncrona",
        numeroSessao: 10,
        modulo: null,
      },
    ];
    const faixas = buildVngFaixas(sessoes, modulos, [
      { data: "2026-08-22", modulo: modulos[0]! },
    ]);
    // 09:00:00 e 9:00 devem fundir numa única faixa presencial
    expect(faixas.filter((f) => f.tipo === "presencial")).toHaveLength(2);
    expect(faixas.some((f) => f.tipo === "sincrona")).toBe(true);
    const auto = faixas.find((f) => f.tipo === "auto");
    expect(auto).toBeTruthy();
    expect(auto!.cells["2026-08-17"]?.label).toBe("M1");
    expect(auto!.cells["2026-08-17"]?.isPrazo).toBeFalsy();
    expect(auto!.cells["2026-08-18"]?.label).toBe("M1");
    expect(auto!.cells["2026-08-21"]?.label).toBe("M1");
    expect(auto!.cells["2026-08-22"]?.label).toBe("M1");
    expect(auto!.cells["2026-08-22"]?.isPrazo).toBe(true);
    expect(auto!.cells["2026-08-23"]).toBeUndefined();

    const legenda = buildVngLegenda(sessoes, modulos, faixas);
    expect(legenda.some((l) => l.codigo === "M1")).toBe(true);
  });

  it("sessão M5/M6 inicia auto para ambos os módulos", () => {
    const sessoes = [
      {
        data: "2026-09-02",
        horaInicio: "09:00",
        horaFim: "13:00",
        modalidade: "presencial",
        titulo: "Aula Presencial dos Módulos 5 e 6",
        numeroSessao: 5,
        modulo: modulos[2],
      },
    ];
    const faixas = buildVngFaixas(sessoes, modulos, [
      { data: "2026-09-05", modulo: modulos[2]! },
      { data: "2026-09-05", modulo: modulos[3]! },
    ]);
    const auto = faixas.find((f) => f.tipo === "auto")!;
    expect(auto.cells["2026-09-02"]?.label).toBe("M5/M6");
    expect(auto.cells["2026-09-04"]?.label).toBe("M5/M6");
    expect(auto.cells["2026-09-05"]?.isPrazo).toBe(true);
  });

  it("data limite de M5/M6 não inclui M7/M8 cuja sessão começa no mesmo dia", () => {
    const sessoes = [
      {
        data: "2026-09-02",
        horaInicio: "09:00",
        horaFim: "13:00",
        modalidade: "presencial",
        titulo: "Aula Presencial dos Módulos 5 e 6",
        numeroSessao: 5,
        modulo: modulos[2],
      },
      {
        data: "2026-09-09",
        horaInicio: "09:00",
        horaFim: "13:00",
        modalidade: "presencial",
        titulo: "Aula Presencial dos Módulos 7 e 8",
        numeroSessao: 7,
        modulo: modulos[4],
      },
    ];
    const faixas = buildVngFaixas(sessoes, modulos, [
      { data: "2026-09-09", modulo: modulos[2]! },
      { data: "2026-09-09", modulo: modulos[3]! },
      { data: "2026-09-15", modulo: modulos[4]! },
      { data: "2026-09-15", modulo: modulos[5]! },
    ]);
    const auto = faixas.find((f) => f.tipo === "auto")!;
    expect(auto.cells["2026-09-09"]?.label).toBe("M5/M6");
    expect(auto.cells["2026-09-09"]?.isPrazo).toBe(true);
    expect(auto.cells["2026-09-10"]?.label).toBe("M7/M8");
    expect(auto.cells["2026-09-10"]?.isPrazo).toBeFalsy();
    expect(auto.cells["2026-09-15"]?.label).toBe("M7/M8");
    expect(auto.cells["2026-09-15"]?.isPrazo).toBe(true);
  });
});
