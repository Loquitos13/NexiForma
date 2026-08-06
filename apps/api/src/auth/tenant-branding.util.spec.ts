import {
  publicTenantLogoPath,
  resolveTenantPublicBranding,
  tenantDisplayInitials,
} from "./tenant-branding.util";

describe("tenant-branding.util", () => {
  it("gera iniciais de uma ou duas palavras", () => {
    expect(tenantDisplayInitials("Demonstração NexiForma, Lda.")).toBe("DN");
    expect(tenantDisplayInitials("Acme")).toBe("AC");
    expect(tenantDisplayInitials("")).toBe("?");
  });

  it("resolve branding público com logo em storage", () => {
    const branding = resolveTenantPublicBranding(
      {
        branding: {
          companyName: "Forma Futuro",
          logoStorageKey: "tenants/x/logo.png",
        },
      },
      "Legal Name Lda",
      "formafuturo",
    );
    expect(branding.displayName).toBe("Forma Futuro");
    expect(branding.logoUrl).toBe(publicTenantLogoPath("formafuturo"));
    expect(branding.initials).toBe("FF");
  });

  it("aceita logo externo https", () => {
    const branding = resolveTenantPublicBranding(
      {
        branding: {
          logoUrl: "https://cdn.example.com/logo.png",
        },
      },
      "Demo Lda",
      "demo",
    );
    expect(branding.logoUrl).toBe("https://cdn.example.com/logo.png");
  });
});
