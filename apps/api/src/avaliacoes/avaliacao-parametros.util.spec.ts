import {
  DEFAULT_AVALIACAO_PARAMETROS,
  mergeTenantAvaliacaoParametros,
  normalizeAvaliacaoTipo,
  parseTenantAvaliacaoParametros,
} from "./avaliacao-parametros.util";

describe("avaliacao-parametros.util", () => {
  it("aplica defaults quando metadata vazio", () => {
    const p = parseTenantAvaliacaoParametros(null);
    expect(p.escalaMaxima).toBe(100);
    expect(p.notaMinimaAprovacao).toBe(50);
    expect(p.tiposPermitidos).toEqual(["continua", "final", "recuperacao"]);
  });

  it("limita nota mínima à escala máxima", () => {
    const p = parseTenantAvaliacaoParametros({
      avaliacaoParametros: { escalaMaxima: 20, notaMinimaAprovacao: 99 },
    });
    expect(p.escalaMaxima).toBe(20);
    expect(p.notaMinimaAprovacao).toBe(50);
  });

  it("normaliza tipos com acentos", () => {
    expect(normalizeAvaliacaoTipo("contínua")).toBe("continua");
    expect(normalizeAvaliacaoTipo("recuperação")).toBe("recuperacao");
  });

  it("merge preserva outros campos do metadata", () => {
    const merged = mergeTenantAvaliacaoParametros(
      { foo: "bar", avaliacaoParametros: DEFAULT_AVALIACAO_PARAMETROS },
      { notaMinimaAprovacao: 60 },
    );
    expect(merged.foo).toBe("bar");
    expect((merged.avaliacaoParametros as { notaMinimaAprovacao: number }).notaMinimaAprovacao).toBe(60);
  });
});
