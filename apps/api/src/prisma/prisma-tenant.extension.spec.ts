import {
  withTenantWhere,
  withTenantUniqueWhere,
  injectTenantIntoArgs,
  hasNestedRelationData,
  TENANT_SCOPED_MODELS,
} from "./prisma-tenant.extension";

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

  it("merges tenantId into compound unique keys instead of AND", () => {
    const tenantId = "550e8400-e29b-41d4-a716-446655440000";
    expect(
      withTenantUniqueWhere({ tenantId_provider: { provider: "ZOOM" } }, tenantId),
    ).toEqual({
      tenantId_provider: { provider: "ZOOM", tenantId },
    });
  });

  it("preserves id-only unique where for update/findUnique handlers", () => {
    const where = { id: "64cef316-1a9f-4244-8acf-ff560cd6ac54" };
    expect(withTenantUniqueWhere(where, "550e8400-e29b-41d4-a716-446655440000")).toEqual(where);
  });

  it("uses unique where helper on update operations", () => {
    const args: Record<string, unknown> = {
      where: { tenantId_provider: { provider: "TEAMS" } },
      data: { mode: "OAUTH" },
    };
    injectTenantIntoArgs("update", args, "550e8400-e29b-41d4-a716-446655440000");
    expect(args.where).toEqual({
      tenantId_provider: { provider: "TEAMS", tenantId: "550e8400-e29b-41d4-a716-446655440000" },
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

  it("detects nested relation writes in update data", () => {
    expect(hasNestedRelationData({ valorCentavos: 100 })).toBe(false);
    expect(
      hasNestedRelationData({
        valorCentavos: 100,
        linhas: { create: [{ descricao: "Serviço" }] },
      }),
    ).toBe(true);
    expect(
      hasNestedRelationData({
        linhas: { deleteMany: {}, create: [{ descricao: "Serviço" }] },
      }),
    ).toBe(true);
  });
});
