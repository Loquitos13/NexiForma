import {
  isAtSandboxMock,
  readAtMode,
  resolveAtFaturasEndpoint,
  resolveAtSeriesEndpoint,
} from "./at-integration.util";
import { AT_FATURAS_ENDPOINTS } from "./at-faturas-constants";
import { AT_SERIES_ENDPOINTS } from "./at-series-constants";

function mockConfig(values: Record<string, string | undefined>) {
  return {
    get: (key: string) => values[key],
  } as never;
}

describe("at-integration.util", () => {
  it("resolve endpoints sandbox vs produção", () => {
    const cfg = mockConfig({});
    expect(resolveAtFaturasEndpoint(cfg, "sandbox")).toBe(AT_FATURAS_ENDPOINTS.sandbox);
    expect(resolveAtFaturasEndpoint(cfg, "production")).toBe(AT_FATURAS_ENDPOINTS.production);
    expect(resolveAtSeriesEndpoint(cfg, "sandbox")).toBe(AT_SERIES_ENDPOINTS.sandbox);
  });

  it("sandbox mock só com AT_*_SANDBOX_MOCK=1", () => {
    expect(isAtSandboxMock(mockConfig({ AT_FATURAS_SANDBOX_MOCK: "1" }), "AT_FATURAS")).toBe(true);
    expect(isAtSandboxMock(mockConfig({}), "AT_FATURAS")).toBe(false);
  });

  it("lê modos AT_FATURAS_MODE", () => {
    expect(readAtMode(mockConfig({ AT_FATURAS_MODE: "sandbox" }), "AT_FATURAS_MODE")).toBe("sandbox");
    expect(readAtMode(mockConfig({ AT_FATURAS_MODE: "production" }), "AT_FATURAS_MODE")).toBe(
      "production",
    );
    expect(readAtMode(mockConfig({}), "AT_FATURAS_MODE")).toBe("disabled");
  });
});
