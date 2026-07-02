import {
  buildRegistarSerieBody,
} from "./at-series-payload.util";
import {
  buildMockSeriesSuccessResponse,
  parseAtSeriesSoapResponse,
} from "./at-series-response.util";
import { AtSeriesIntegrationService } from "./at-series-integration.service";

describe("at-series-payload.util", () => {
  it("monta corpo registarSerie conforme spec AT", () => {
    const body = buildRegistarSerieBody({
      serie: "2026",
      tipoDocumento: "FT",
      numInicialSeq: 1,
      dataInicioPrevUtiliz: new Date("2026-01-01T00:00:00Z"),
      numCertSWFatur: "9999",
    });
    expect(body).toContain("<serie>2026</serie>");
    expect(body).toContain("<tipoDoc>FT</tipoDoc>");
    expect(body).toContain("<numInicialSeq>1</numInicialSeq>");
    expect(body).toContain("<dataInicioPrevUtiliz>2026-01-01</dataInicioPrevUtiliz>");
    expect(body).toContain("<numCertSWFatur>9999</numCertSWFatur>");
    expect(body).toContain("<meioProcessamento>PI</meioProcessamento>");
  });

  it("gera envelope SOAP com corpo registarSerie", () => {
    const body = buildRegistarSerieBody({
      serie: "A1",
      tipoDocumento: "FT",
      numInicialSeq: 1,
      dataInicioPrevUtiliz: new Date("2026-06-01"),
      numCertSWFatur: "1234",
    });
    expect(body).toContain("registarSerie");
    expect(body).toContain("<serie>A1</serie>");
  });
});

describe("at-series-response.util", () => {
  it("extrai código de validação da resposta", () => {
    const parsed = parseAtSeriesSoapResponse(
      buildMockSeriesSuccessResponse("ABCD1234"),
    );
    expect(parsed.sucesso).toBe(true);
    expect(parsed.codigoValidacao).toBe("ABCD1234");
  });
});

describe("AtSeriesIntegrationService sandbox", () => {
  it("gera código AA em sandbox mock", () => {
    const svc = new AtSeriesIntegrationService({
      get: (key: string) => {
        if (key === "AT_SERIES_MODE") return "sandbox";
        if (key === "AT_SERIES_SANDBOX_MOCK") return "1";
        return undefined;
      },
    } as never);
    const code = svc.gerarCodigoValidacaoSandbox("2026", "FT");
    expect(code).toMatch(/^AA[A-Z0-9]{6}$/);
  });
});
