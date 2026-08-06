import { buildDgertChecklist } from "./dgert-checklist.util";

describe("buildDgertChecklist", () => {
  const base = {
    tenantNif: "501964843",
    curso: {
      codigoUfcd: "7834",
      objetivos: "Objectivos de teste",
      cargaHoras: 50,
      modalidade: "presencial",
    },
    acao: {
      dataInicio: new Date("2025-01-01"),
      dataFim: new Date("2025-12-31"),
      estado: "EM_CURSO",
    },
    cronograma: { versao: 1, aprovadoEm: new Date("2025-01-05") },
    sessoes: [
      {
        numeroSessao: 1,
        horaInicio: "09:00",
        horaFim: "12:30",
        modalidade: "presencial",
        estado: "REALIZADA",
        formador: { nif: "501964843", ccNumero: "123", ccpNumero: null },
        sumarios: [{ imutavel: true, assinadoEm: new Date(), conteudo: "Conteúdo" }],
        folhasPresenca: [{ fechadaEm: new Date(), presencas: [{ presente: true }] }],
      },
    ],
    formandosAtivos: [{ nome: "João", nif: "501964843" }],
    totalMatriculas: 1,
    presencasPresentes: 1,
    presencasTotal: 1,
  };

  it("marca pronto para inspecção quando obrigatórios cumpridos", () => {
    const r = buildDgertChecklist(base);
    expect(r.prontoInspecao).toBe(true);
    expect(r.totalObrigatorios).toBeGreaterThan(10);
  });

  it("falha NIF entidade inválido", () => {
    const r = buildDgertChecklist({ ...base, tenantNif: "999999999" });
    const item = r.items.find((i) => i.id === "entidade_nif");
    expect(item?.ok).toBe(false);
    expect(r.prontoInspecao).toBe(false);
  });

  it("marca evidências de auditoria como recomendadas", () => {
    const r = buildDgertChecklist({
      ...base,
      totalAvaliacoes: 0,
      totalCertificados: 0,
      totalDocumentosMatricula: 0,
    });
    expect(r.items.find((i) => i.id === "avaliacoes_formandos")?.ok).toBe(false);
    expect(r.items.find((i) => i.id === "certificados_emitidos")?.ok).toBe(false);
    expect(r.items.find((i) => i.id === "documentos_matricula")?.ok).toBe(false);
    expect(r.prontoInspecao).toBe(true);
  });

  it("exige formador em todas as sessões", () => {
    const r = buildDgertChecklist({
      ...base,
      sessoes: [
        ...base.sessoes,
        {
          numeroSessao: 2,
          horaInicio: "14:00",
          horaFim: "17:00",
          modalidade: "presencial",
          estado: "AGENDADA",
          formador: null,
          sumarios: [],
          folhasPresenca: [],
        },
      ],
    });
    const item = r.items.find((i) => i.id === "formadores");
    expect(item?.ok).toBe(false);
    expect(r.prontoInspecao).toBe(false);
  });
});
