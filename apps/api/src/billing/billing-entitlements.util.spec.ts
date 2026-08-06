import { resolveTenantEntitlements, isApiPathAllowed, isPortalPathAllowedByEntitlements, canAccessFaturacaoPortal } from "@nexiforma/shared";
import { resolvePostLoginPath } from "@nexiforma/shared";

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
    expect(e.canAccessEnterpriseFeatures).toBe(true);
    expect(e.activeAddons).toEqual(
      expect.arrayContaining(["crm", "faturacao_at", "formacao_teams", "inteligencia_ia"]),
    );
  });

  it("Starter não inclui funcionalidades Enterprise", () => {
    const e = resolveTenantEntitlements("starter", []);
    expect(e.canAccessEnterpriseFeatures).toBe(false);
  });

  it("subscrição cancelada bloqueia módulos mas mantém billing", () => {
    const e = resolveTenantEntitlements("enterprise", [], { subscriptionStatus: "CANCELED" });
    expect(e.subscriptionActive).toBe(false);
    expect(e.canAccessCrm).toBe(false);
    expect(e.canAccessEnterpriseFeatures).toBe(false);
    expect(isPortalPathAllowedByEntitlements("/portal/billing", e)).toBe(true);
    expect(isPortalPathAllowedByEntitlements("/portal/enterprise", e)).toBe(false);
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

  it("comercial com CRM acede a entidades-cliente e propostas", () => {
    expect(
      isApiPathAllowed("entidades-cliente", crmOnly, { role: "comercial", kind: "tenant" }),
    ).toBe(true);
    expect(
      isApiPathAllowed("propostas", crmOnly, { role: "comercial", kind: "tenant" }),
    ).toBe(true);
    expect(
      isApiPathAllowed("crm/leads", crmOnly, { role: "comercial", kind: "tenant" }),
    ).toBe(true);
    expect(
      isApiPathAllowed("calendario/eventos", crmOnly, { role: "comercial", kind: "tenant" }),
    ).toBe(true);
    expect(
      isPortalPathAllowedByEntitlements("/portal/calendario", crmOnly, "comercial"),
    ).toBe(true);
    expect(
      isApiPathAllowed("integracoes/disponibilidade", crmOnly, {
        role: "comercial",
        kind: "tenant",
      }),
    ).toBe(true);
    expect(isApiPathAllowed("integracoes/disponibilidade", crmOnly)).toBe(true);
    expect(isApiPathAllowed("integracoes", crmOnly)).toBe(false);
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

  it("portal enterprise só no plano Enterprise", () => {
    const ent = resolveTenantEntitlements("enterprise", []);
    const starter = resolveTenantEntitlements("starter", []);
    expect(isPortalPathAllowedByEntitlements("/portal/enterprise", ent)).toBe(true);
    expect(isPortalPathAllowedByEntitlements("/portal/enterprise", starter)).toBe(false);
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
    expect(
      isApiPathAllowed("presenca-checkin/abc", ent, { role: "formando", kind: "tenant" }),
    ).toBe(true);
  });

  it("formando com formação core acede ao check-in QR", () => {
    const ent = resolveTenantEntitlements("modular", ["formacao_core"]);
    expect(
      isApiPathAllowed("presenca-checkin/token123", ent, { role: "formando", kind: "tenant" }),
    ).toBe(true);
  });

  it("formando modular sem módulos não acede a lms", () => {
    const modularVazio = resolveTenantEntitlements("modular", []);
    expect(
      isApiPathAllowed("lms/minhas-sessoes", modularVazio, { role: "formando", kind: "tenant" }),
    ).toBe(false);
  });
});

describe("resolvePostLoginPath com entitlements", () => {
  it("rejeita next enterprise para tenant starter", () => {
    const starter = resolveTenantEntitlements("starter", []);
    expect(
      resolvePostLoginPath("tenant_manager", "tenant", "/portal/enterprise", starter),
    ).toBe("/portal");
  });

  it("permite next enterprise para tenant enterprise", () => {
    const enterprise = resolveTenantEntitlements("enterprise", []);
    expect(
      resolvePostLoginPath("tenant_manager", "tenant", "/portal/enterprise", enterprise),
    ).toBe("/portal/enterprise");
  });

  it("comercial sem CRM não acede a faturação", () => {
    const fatOnly = resolveTenantEntitlements("modular", ["faturacao_at"]);
    expect(canAccessFaturacaoPortal("comercial", fatOnly)).toBe(false);
    expect(canAccessFaturacaoPortal("tenant_manager", fatOnly)).toBe(true);
    expect(
      isPortalPathAllowedByEntitlements("/portal/crm/faturas", fatOnly, "comercial"),
    ).toBe(false);
    expect(
      resolvePostLoginPath("comercial", "tenant", "/portal/crm/faturas", fatOnly),
    ).toBe("/acesso-negado");
  });
});
