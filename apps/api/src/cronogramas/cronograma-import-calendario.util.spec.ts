import {
  extrairSessoesDeHtmlCalendario,
  sanitizarTextoLegivel,
} from "./cronograma-import-calendario.util";

describe("cronograma-import-calendario.util", () => {
  it("rejeita lixo de PDF na legenda", () => {
    expect(sanitizarTextoLegivel("wo+ueousngui+sdngs+dign → Módulo 4")).toBeNull();
    expect(sanitizarTextoLegivel("FPA = Formação Pedagógica")).toContain("FPA");
  });

  it("lê células do calendário HTML DGERT", () => {
    const html = `
      <table class="cal">
        <caption>MARÇO 2026</caption>
        <thead><tr>${Array.from({ length: 31 }, (_, i) => `<th>${i + 1}</th>`).join("")}</tr></thead>
        <tbody><tr>
          ${Array.from({ length: 31 }, (_, i) =>
            i === 14
              ? `<td class="ses" style="background:#b8d4f0"><span>FPA (4h)</span></td>`
              : i === 15
                ? `<td class="ses"><span>AC (4h)+FPA (2h)</span></td>`
                : `<td></td>`,
          ).join("")}
        </tr></tbody>
      </table>
      <table class="mods">
        <tr><td class="c-cod">FPA</td><td>Formação Pedagógica</td><td>25</td><td>Ana</td></tr>
        <tr><td class="c-cod">AC</td><td>Atendimento</td><td>10</td><td>Bruno</td></tr>
      </table>
    `;

    const draft = extrairSessoesDeHtmlCalendario(html, {
      horarioInicio: "19:00",
      horarioFim: "23:00",
      modulos: [
        { id: "m1", codigo: "FPA", titulo: "Formação Pedagógica" },
        { id: "m2", codigo: "AC", titulo: "Atendimento" },
      ],
    });

    expect(draft.sessoes.length).toBeGreaterThanOrEqual(2);
    expect(draft.sessoes.some((s) => s.data === "2026-03-15")).toBe(true);
    expect(draft.sessoes.some((s) => s.moduloUnidadeId === "m1")).toBe(true);
    expect(draft.legendaResumo).toMatch(/FPA/);
  });
});
