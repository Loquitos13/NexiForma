import {
  buildTenantAmbiguousPayload,
  isTenantOperational,
  normalizeAuthEmail,
  normalizeQueryParam,
  tenantLoginLockoutKey,
  TENANT_AUTH_AMBIGUOUS_CODE,
} from "./tenant-auth-resolve.util";

describe("tenant-auth-resolve.util", () => {
  it("detecta tenant operacional", () => {
    expect(isTenantOperational("TRIAL")).toBe(true);
    expect(isTenantOperational("SUSPENDED")).toBe(false);
  });

  it("normaliza email", () => {
    expect(normalizeAuthEmail(" User@Mail.com ")).toBe("user@mail.com");
  });

  it("gera chave de lockout com ou sem slug", () => {
    expect(tenantLoginLockoutKey("a@b.c", "demo")).toBe("demo:a@b.c");
    expect(tenantLoginLockoutKey("a@b.c")).toBe("email:a@b.c");
  });

  it("monta payload de tenant ambíguo", () => {
    const payload = buildTenantAmbiguousPayload([
      { slug: "acme", legalName: "Acme SA", role: "ADMIN", roleLabel: "Gestor", initials: "AS" },
      { slug: "acme", legalName: "Duplicado", role: "ADMIN", roleLabel: "Gestor", initials: "DU" },
      { slug: "beta", legalName: "Beta Lda", role: "FORMADOR", roleLabel: "Formador", initials: "BL" },
    ]);
    expect(payload.code).toBe(TENANT_AUTH_AMBIGUOUS_CODE);
    expect(payload.tenants).toHaveLength(2);
  });

  it("normaliza query param repetido", () => {
    expect(normalizeQueryParam(["formafuturo", "formafuturo"])).toBe("formafuturo");
    expect(normalizeQueryParam(undefined)).toBe("");
  });
});
