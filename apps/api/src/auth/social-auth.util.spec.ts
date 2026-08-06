import {
  extractOAuthEmail,
  isSocialProviderEnabled,
  readTenantSocialLogin,
  resolveOAuthReturnOrigin,
  type SocialProvider,
} from "./social-auth.util";

describe("social-auth.util", () => {
  it("activa provider por defeito quando plataforma configurada", () => {
    expect(isSocialProviderEnabled("google", {}, true)).toBe(true);
    expect(isSocialProviderEnabled("microsoft", {}, true)).toBe(true);
  });

  it("desactiva quando plataforma não configurada", () => {
    expect(isSocialProviderEnabled("google", {}, false)).toBe(false);
  });

  it("respeita opt-out do tenant", () => {
    expect(isSocialProviderEnabled("google", { socialLogin: { google: false } }, true)).toBe(false);
    expect(
      isSocialProviderEnabled("microsoft", { socialLogin: { microsoft: false } }, true),
    ).toBe(false);
  });

  it("lê configuração parcial", () => {
    const cfg = readTenantSocialLogin({ socialLogin: { google: true } });
    expect(cfg.google).toBe(true);
    expect(cfg.microsoft).toBeUndefined();
  });

  it("extrai email Microsoft de preferred_username", () => {
    expect(
      extractOAuthEmail({ preferred_username: "User@Contoso.com" }),
    ).toBe("user@contoso.com");
  });

  it("resolve return origin permitido", () => {
    expect(resolveOAuthReturnOrigin("http://localhost:3000", "http://127.0.0.1:3000")).toBe(
      "http://localhost:3000",
    );
    expect(resolveOAuthReturnOrigin("https://evil.example", "http://localhost:3000")).toBe(
      "http://localhost:3000",
    );
  });
});

describe("social provider keys", () => {
  const providers: SocialProvider[] = ["google", "microsoft"];
  it.each(providers)("tem provider %s", (p) => {
    expect(["google", "microsoft"]).toContain(p);
  });
});
