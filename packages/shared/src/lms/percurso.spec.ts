import {
  percentualProgressoPercurso,
  tarefaConcluidaEfectiva,
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
