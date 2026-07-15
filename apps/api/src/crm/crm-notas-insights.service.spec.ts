import { CrmNotasInsightsService } from "./crm-notas-insights.service";
import { CrmLlmService } from "./crm-llm.service";

describe("CrmNotasInsightsService", () => {
  const llm = { completeJson: jest.fn().mockResolvedValue(null), isEnabled: () => false } as unknown as CrmLlmService;
  const svc = new CrmNotasInsightsService(llm);

  it("extrai resumo e gatilhos em modo local", async () => {
    const { insights, engine } = await svc.extrair({
      tipo: "REUNIAO",
      situacaoActual: "Cliente interessado em renovação de formação DGERT.",
      proximoPassoNota: "Enviar proposta até 2026-07-15",
      orcamentoTiming: "Orçamento aprovado 5000€",
      decisor: "Maria Silva RH",
    });
    expect(engine).toBe("local");
    expect(insights.resumo_situacao).toContain("renovação");
    expect(insights.gatilhos_venda.length).toBeGreaterThan(0);
    expect(insights.proximos_passos.length).toBe(1);
    expect(insights.dados_extraidos.orcamentoReferidoEur).toBe(5000);
  });
});
