import {
  condensarTextoCronograma,
  extrairSessoesHeuristica,
  matchModulo,
  normalizarData,
  normalizarHora,
  normalizarImportDraft,
  normalizarModalidade,
  parseLlmJsonResponse,
  stripHtmlToText,
} from "./cronograma-import-ia.util";

describe("cronograma-import-ia.util", () => {
  it("normaliza modalidades e datas PT", () => {
    expect(normalizarModalidade("Presencial")).toBe("presencial");
    expect(normalizarModalidade("Teams / online")).toBe("online");
    expect(normalizarModalidade("trabalho autónomo")).toBe("online");
    expect(normalizarModalidade("b-learning")).toBe("b-learning");
    expect(normalizarData("15/03/2026")).toBe("2026-03-15");
    expect(normalizarHora("9:30")).toBe("09:30");
  });

  it("faz match de módulo por código da legenda", () => {
    const mods = [
      { id: "1", codigo: "FPA", titulo: "Formação Pedagógica" },
      { id: "2", codigo: "AC", titulo: "Atendimento ao Cliente" },
    ];
    expect(matchModulo(mods, "FPA", null)?.id).toBe("1");
    expect(matchModulo(mods, null, "atendimento")?.id).toBe("2");
  });

  it("normaliza draft da IA e renumera sessões", () => {
    const draft = normalizarImportDraft(
      {
        legendaResumo: "FPA = Formação Pedagógica",
        prazoConclusaoLms: "30/04/2026",
        sessoes: [
          {
            data: "2026-03-16",
            horaInicio: "19:00",
            horaFim: "23:00",
            modalidade: "presencial",
            moduloCodigo: "FPA",
          },
          {
            data: "15/03/2026",
            horaInicio: "19:00",
            horaFim: "23:00",
            modalidade: "assíncrono",
            assincrona: true,
            moduloCodigo: "AC",
          },
          { data: "x", horaInicio: "19:00", horaFim: "23:00" },
        ],
      },
      {
        modulos: [
          { id: "m1", codigo: "FPA", titulo: "Formação Pedagógica" },
          { id: "m2", codigo: "AC", titulo: "Atendimento" },
        ],
        formadores: [],
      },
    );

    expect(draft.sessoes).toHaveLength(2);
    expect(draft.sessoes[0]!.numeroSessao).toBe(1);
    expect(draft.sessoes[0]!.data).toBe("2026-03-15");
    expect(draft.sessoes[1]!.moduloUnidadeId).toBe("m1");
    expect(draft.prazoConclusaoLms).toBe("2026-04-30");
    expect(draft.avisos.length).toBeGreaterThan(0);
  });

  it("extrai texto útil de HTML de cronograma", () => {
    const text = stripHtmlToText(
      `<html><body><h1>CRONOGRAMA</h1><table><tr><td>FPA (4h)</td></tr></table><p>Legenda: FPA Formação</p></body></html>`,
    );
    expect(text).toContain("CRONOGRAMA");
    expect(text).toContain("FPA");
    expect(text).not.toContain("<td>");
  });

  it("faz parse robusto de JSON da LLM", () => {
    const withFence = parseLlmJsonResponse('```json\n{"sessoes":[{"data":"2026-01-01"}]}\n```');
    expect(withFence).toEqual({ sessoes: [{ data: "2026-01-01" }] });

    const trailing = parseLlmJsonResponse('{"sessoes":[{"data":"2026-01-01"},],}');
    expect(trailing).toEqual({ sessoes: [{ data: "2026-01-01" }] });

    const arr = parseLlmJsonResponse('[{"data":"2026-01-01","horaInicio":"09:00"}]');
    expect(arr).toEqual({ sessoes: [{ data: "2026-01-01", horaInicio: "09:00" }] });
  });

  it("extrai sessões por heurística sem LLM", () => {
    const texto = [
      "CRONOGRAMA",
      "Horário: Início 19:00 Fim 23:00",
      "15/03/2026 19:00 23:00 FPA (4h) presencial",
      "16/03/2026 FPA (4h)",
      "Prazo tarefas assíncronas: 30/04/2026",
    ].join("\n");

    const draft = extrairSessoesHeuristica(condensarTextoCronograma(texto), {
      horarioInicio: "19:00",
      horarioFim: "23:00",
      modulos: [{ id: "m1", codigo: "FPA", titulo: "Formação" }],
    });

    expect(draft.sessoes.length).toBeGreaterThanOrEqual(2);
    expect(draft.sessoes[0]!.moduloUnidadeId).toBe("m1");
    expect(draft.prazoConclusaoLms).toBe("2026-04-30");
  });
});
