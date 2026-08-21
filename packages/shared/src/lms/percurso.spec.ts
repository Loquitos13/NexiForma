import {
  percentualProgressoPercurso,
  tarefaConcluidaEfectiva,
  moduloProntoParaAvancar,
  resolverContinuarPercurso,
  proximaUnidadeIncompleta,
} from "./percurso";

describe("percentualProgressoPercurso", () => {
  it("conta tarefas bloqueadas no total (2/4 = 50%)", () => {
    const tarefas = [
      { concluido: true, percentual: 100 },
      { concluido: true, percentual: 100 },
      { concluido: false, percentual: 0 },
      { concluido: false, percentual: 0 },
    ];
    expect(percentualProgressoPercurso(tarefas)).toBe(50);
  });

  it("usa percentual >= 100 como concluída", () => {
    const tarefas = [{ concluido: false, percentual: 100 }];
    expect(tarefaConcluidaEfectiva(tarefas[0]!)).toBe(true);
    expect(percentualProgressoPercurso(tarefas)).toBe(100);
  });
});

describe("resolverContinuarPercurso", () => {
  const unidades = [
    { id: "m1", ordem: 0, desbloqueado: true, notaMinima: null, pontuacao: null },
    { id: "m2", ordem: 1, desbloqueado: true, notaMinima: null, pontuacao: null },
    { id: "m3", ordem: 2, desbloqueado: true, notaMinima: null, pontuacao: null },
  ];

  it("salta módulos concluídos e vai ao primeiro incompleto", () => {
    const tarefas = [
      { id: "t1", ordem: 0, moduloUnidadeId: "m1", desbloqueado: true, concluido: true, percentual: 100, notaMinima: null, pontuacao: 100 },
      { id: "t2", ordem: 0, moduloUnidadeId: "m2", desbloqueado: true, concluido: true, percentual: 100, notaMinima: null, pontuacao: 100 },
      { id: "t3", ordem: 0, moduloUnidadeId: "m3", desbloqueado: true, concluido: false, percentual: 0, notaMinima: null, pontuacao: null },
    ];
    expect(resolverContinuarPercurso(unidades, tarefas)).toEqual({ unidadeId: "m3", tarefaId: "t3" });
  });

  it("proximaUnidadeIncompleta salta módulos concluídos no meio", () => {
    const tarefas = [
      { id: "t1", ordem: 0, moduloUnidadeId: "m1", desbloqueado: true, concluido: true, percentual: 100, notaMinima: null, pontuacao: 100 },
      { id: "t2", ordem: 0, moduloUnidadeId: "m2", desbloqueado: true, concluido: true, percentual: 100, notaMinima: null, pontuacao: 100 },
      { id: "t3", ordem: 0, moduloUnidadeId: "m3", desbloqueado: true, concluido: false, percentual: 0, notaMinima: null, pontuacao: null },
    ];
    expect(proximaUnidadeIncompleta(unidades, tarefas, "m1")?.id).toBe("m3");
    expect(moduloProntoParaAvancar(unidades[0]!, tarefas).ok).toBe(true);
    expect(moduloProntoParaAvancar(unidades[2]!, tarefas).ok).toBe(false);
  });
});
