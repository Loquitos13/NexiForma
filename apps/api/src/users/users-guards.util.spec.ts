import {
  isTenantManagerPrismaRole,
  mapUserPublic,
} from "./users-guards.util";

describe("users-guards.util", () => {
  it("identifica papeis de gestor", () => {
    expect(isTenantManagerPrismaRole("ADMIN")).toBe(true);
    expect(isTenantManagerPrismaRole("COORDENADOR")).toBe(false);
    expect(isTenantManagerPrismaRole("COORDENADOR_PEDAGOGICO")).toBe(false);
    expect(isTenantManagerPrismaRole("FINANCEIRO")).toBe(false);
    expect(isTenantManagerPrismaRole("FORMADOR")).toBe(false);
  });

  it("expõe mfaSetupPending sem devolver segredo", () => {
    expect(
      mapUserPublic({
        id: "1",
        email: "a@b.pt",
        displayName: "A",
        role: "ADMIN",
        active: true,
        mfaEnabled: false,
        mfaRequired: true,
        mfaApp: null,
        mfaSecret: "secret",
        emailVerifiedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ).toEqual(
      expect.objectContaining({
        mfaSetupPending: true,
        mfaRequired: true,
      }),
    );
    expect(
      mapUserPublic({
        id: "1",
        email: "a@b.pt",
        displayName: "A",
        role: "ADMIN",
        active: true,
        mfaEnabled: true,
        mfaRequired: false,
        mfaApp: "totp",
        mfaSecret: null,
        emailVerifiedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ).not.toHaveProperty("mfaSecret");
  });
});
