import { injectTenantLogoIntoHtml, tenantLogoImgHtml } from "./tenant-logo-embed.util";

describe("tenantLogoImgHtml", () => {
  it("aceita data-URI e https", () => {
    expect(tenantLogoImgHtml("data:image/png;base64,abc")).toContain('src="data:image/png;base64,abc"');
    expect(tenantLogoImgHtml("https://cdn.example/logo.png")).toContain("https://cdn.example/logo.png");
  });

  it("rejeita paths relativos autenticados", () => {
    expect(tenantLogoImgHtml("/api/v1/portal/tenant/logo")).toBe("");
    expect(tenantLogoImgHtml(null)).toBe("");
  });
});

describe("injectTenantLogoIntoHtml", () => {
  it("insere logo após body", () => {
    const html = "<html><body><h1>Doc</h1></body></html>";
    const out = injectTenantLogoIntoHtml(html, "data:image/png;base64,xx");
    expect(out).toContain('class="tenant-logo-header"');
    expect(out).toContain("<h1>Doc</h1>");
  });

  it("não altera HTML sem logo válido", () => {
    const html = "<html><body>x</body></html>";
    expect(injectTenantLogoIntoHtml(html, "/api/v1/portal/tenant/logo")).toBe(html);
  });
});
