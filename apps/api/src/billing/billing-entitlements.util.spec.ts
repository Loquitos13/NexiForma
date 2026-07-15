import { resolveTenantEntitlements, isApiPathAllowed, isPortalPathAllowedByEntitlements } from "@nexiforma/shared";

describe("resolveTenantEntitlements - módulos avulsos", () => {
  it("plano modular + CRM activa só comercial, sem faturação nem Core", () => {
    const e = resolveTenantEntitlements("modular", ["crm"]);
    expect(e.isModularSubscription).toBe(true);
    expect(e.canAccessCoreFormation).toBe(false);
    expect(e.canAccessCrm).toBe(true);
    expect(e.canAccessFaturacao).toBe(false);
    expect(e.canAccessFormacaoTeams).toBe(false);
  });

  it("plano modular + Faturação AT activa faturação e clientes, sem CRM", () => {
    const e = resolveTenantEntitlements("modular", ["faturacao_at"]);
    expect(e.canAccessCrm).toBe(false);
    expect(e.canAccessFaturacao).toBe(true);
    expect(e.canAccessCoreFormation).toBe(false);
  });

  it("plano modular + Formação Core activa LMS/dossiê, sem CRM", () => {
    const e = resolveTenantEntitlements("modular", ["formacao_core"]);
    expect(e.canAccessCoreFormation).toBe(true);
    expect(e.canAccessCrm).toBe(false);
    expect(e.canAccessFaturacao).toBe(false);
  });

  it("pacote legado crm_faturacao activa CRM e Faturação", () => {
    const e = resolveTenantEntitlements("modular", ["crm_faturacao"]);
    expect(e.canAccessCrm).toBe(true);
    expect(e.canAccessFaturacao).toBe(true);
  });

  it("Enterprise inclui CRM e Faturação separados", () => {
    const e = resolveTenantEntitlements("enterprise", []);
    expect(e.canAccessCrm).toBe(true);
    expect(e.canAccessFaturacao).toBe(true);
    expect(e.canAccessCoreFormation).toBe(true);
    expect(e.activeAddons).toEqual(
      expect.arrayContaining(["crm", "faturacao_at", "formacao_teams", "inteligencia_ia"]),
    );
  });

  it("Starter + CRM add-on mantém Core formação", () => {
    const e = resolveTenantEntitlements("starter", ["crm"]);
    expect(e.isModularSubscription).toBe(false);
    expect(e.canAccessCoreFormation).toBe(true);
    expect(e.canAccessCrm).toBe(true);
    expect(e.canAccessFaturacao).toBe(false);
  });

  it("modular aceita módulos avulsos válidos", () => {
    const e = resolveTenantEntitlements("modular", [
      "crm",
      "inteligencia_ia",
      "invalid" as never,
    ]);
    expect(e.activeAddons).toEqual(["crm", "inteligencia_ia"]);
    expect(e.canAccessInteligenciaIa).toBe(true);
  });
});

describe("module-access enforcement", () => {
  const crmOnly = resolveTenantEntitlements("modular", ["crm"]);
  const fatOnly = resolveTenantEntitlements("modular", ["faturacao_at"]);
  const formacaoOnly = resolveTenantEntitlements("modular", ["formacao_core"]);

  it("bloqueia API formação em modular só CRM", () => {
    expect(isApiPathAllowed("cursos", crmOnly)).toBe(false);
    expect(isApiPathAllowed("crm/leads", crmOnly)).toBe(true);
  });

  it("bloqueia faturação API em modular só CRM", () => {
    expect(isApiPathAllowed("crm/faturas", crmOnly)).toBe(false);
    expect(isApiPathAllowed("propostas", crmOnly)).toBe(true);
  });

  it("permite faturação API em modular só Faturação AT", () => {
    expect(isApiPathAllowed("crm/faturas", fatOnly)).toBe(true);
    expect(isApiPathAllowed("entidades-cliente", fatOnly)).toBe(true);
    expect(isApiPathAllowed("crm/leads", fatOnly)).toBe(false);
    expect(isApiPathAllowed("propostas", fatOnly)).toBe(false);
  });

  it("bloqueia portal CRM comercial em modular só Faturação", () => {
    expect(isPortalPathAllowedByEntitlements("/portal/crm/leads", fatOnly)).toBe(false);
    expect(isPortalPathAllowedByEntitlements("/portal/crm/faturas", fatOnly)).toBe(true);
    expect(isPortalPathAllowedByEntitlements("/portal/clientes", fatOnly)).toBe(true);
  });

  it("formação modular acede a cursos", () => {
    expect(isApiPathAllowed("cursos", formacaoOnly)).toBe(true);
    expect(isPortalPathAllowedByEntitlements("/portal/acoes", formacaoOnly)).toBe(true);
  });

  it("formando enterprise acede a lms e calendário", () => {
    const ent = resolveTenantEntitlements("enterprise", []);
    expect(
      isApiPathAllowed("lms/minhas-sessoes", ent, { role: "formando", kind: "tenant" }),
    ).toBe(true);
    expect(
      isApiPathAllowed("calendario/eventos", ent, { role: "formando", kind: "tenant" }),
    ).toBe(true);
    expect(
      isApiPathAllowed("v1/lms/minhas-sessoes", ent, { role: "formando", kind: "tenant" }),
    ).toBe(true);
  });

  it("formando modular sem módulos não acede a lms", () => {
    const modularVazio = resolveTenantEntitlements("modular", []);
    expect(
      isApiPathAllowed("lms/minhas-sessoes", modularVazio, { role: "formando", kind: "tenant" }),
    ).toBe(false);
  });
});
