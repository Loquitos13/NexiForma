import { AtFaturasIntegrationService } from "./at-faturas-integration.service";

function mockConfig(values: Record<string, string | undefined>) {
  return { get: (key: string) => values[key] } as never;
}

describe("AtFaturasIntegrationService modos", () => {
  it("sandbox real aponta para porta 700", () => {
    const svc = new AtFaturasIntegrationService(
      mockConfig({ AT_FATURAS_MODE: "sandbox" }),
    );
    const cfg = svc.getPublicConfig();
    expect(cfg.sandboxSimulado).toBe(false);
    expect(cfg.sandboxReal).toBe(true);
    expect(cfg.endpoint).toContain(":700/");
  });

  it("sandbox mock com AT_FATURAS_SANDBOX_MOCK=1", () => {
    const svc = new AtFaturasIntegrationService(
      mockConfig({ AT_FATURAS_MODE: "sandbox", AT_FATURAS_SANDBOX_MOCK: "1" }),
    );
    const cfg = svc.getPublicConfig();
    expect(cfg.sandboxSimulado).toBe(true);
    expect(cfg.sandboxReal).toBe(false);
  });

  it("simula registo em sandbox mock", async () => {
    const svc = new AtFaturasIntegrationService(
      mockConfig({ AT_FATURAS_MODE: "sandbox", AT_FATURAS_SANDBOX_MOCK: "1" }),
    );
    const r = await svc.registarDocumento(
      {
        nifEmitente: "599999993",
        nifCliente: "599999993",
        tipoDocumento: "FT",
        serie: "A",
        numero: 1,
        atcud: "X-1",
        dataEmissao: new Date(),
        valorCentavos: 100,
        ivaCentavos: 23,
        moeda: "EUR",
        invoiceStatus: "N",
        linhas: [],
      },
      { nifEmitente: "599999993", subutilizador: "37", password: "testes1234" },
    );
    expect(r.sucesso).toBe(true);
    expect(r.mensagemAt).toContain("simulação local");
  });
});
