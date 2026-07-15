import { ConfigService } from "@nestjs/config";
import { isAllowedAppPublicUrl, resolveAppPublicUrl } from "./app-public-url.util";

function mockConfig(values: Record<string, string | undefined>): ConfigService {
  return {
    get: (key: string) => values[key],
  } as ConfigService;
}

describe("app-public-url", () => {
  it("prefere origem do pedido em desenvolvimento (LAN)", () => {
    const config = mockConfig({
      NODE_ENV: "development",
      APP_PUBLIC_URL: "http://localhost:3000",
    });
    const url = resolveAppPublicUrl(config, {
      headers: { "x-nexiforma-app-public-url": "http://192.168.1.86:3000" },
    });
    expect(url).toBe("http://192.168.1.86:3000");
  });

  it("em produção só aceita origens configuradas", () => {
    const config = mockConfig({
      NODE_ENV: "production",
      APP_PUBLIC_URL: "https://app.nexiforma.pt",
      CORS_ORIGIN: "https://app.nexiforma.pt",
    });
    expect(isAllowedAppPublicUrl("https://app.nexiforma.pt", config)).toBe(true);
    expect(isAllowedAppPublicUrl("http://192.168.1.86:3000", config)).toBe(false);
    const url = resolveAppPublicUrl(config, {
      headers: { "x-nexiforma-app-public-url": "http://192.168.1.86:3000" },
    });
    expect(url).toBe("https://app.nexiforma.pt");
  });
});
