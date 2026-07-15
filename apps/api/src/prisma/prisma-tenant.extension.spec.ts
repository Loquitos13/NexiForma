import { withTenantWhere, injectTenantIntoArgs, TENANT_SCOPED_MODELS } from "./prisma-tenant.extension";

describe("prisma-tenant.extension", () => {
  it("scopes empty where with tenantId", () => {
    expect(withTenantWhere(undefined, "550e8400-e29b-41d4-a716-446655440000")).toEqual({
      tenantId: "550e8400-e29b-41d4-a716-446655440000",
    });
  });

  it("preserves explicit tenantId in where", () => {
    const where = { id: "abc", tenantId: "550e8400-e29b-41d4-a716-446655440000" };
    expect(withTenantWhere(where, "other-tenant")).toEqual(where);
  });

  it("wraps existing filters with AND tenantId", () => {
    expect(withTenantWhere({ estado: "ATIVA" }, "550e8400-e29b-41d4-a716-446655440000")).toEqual({
      AND: [{ estado: "ATIVA" }, { tenantId: "550e8400-e29b-41d4-a716-446655440000" }],
    });
  });

  it("injects tenantId on create", () => {
    const args: Record<string, unknown> = { data: { nome: "Teste" } };
    injectTenantIntoArgs("create", args, "550e8400-e29b-41d4-a716-446655440000");
    expect(args.data).toEqual({
      nome: "Teste",
      tenantId: "550e8400-e29b-41d4-a716-446655440000",
    });
  });

  it("lists tenant-scoped operational models", () => {
    expect(TENANT_SCOPED_MODELS.has("FaturaComercial")).toBe(true);
    expect(TENANT_SCOPED_MODELS.has("LeadComercial")).toBe(true);
    expect(TENANT_SCOPED_MODELS.has("Tenant")).toBe(false);
  });
});
