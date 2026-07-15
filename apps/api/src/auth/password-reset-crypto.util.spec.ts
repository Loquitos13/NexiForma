import {
  decryptPasswordResetUser,
  encryptPasswordResetUser,
  maskEmail,
} from "./password-reset-crypto.util";

describe("password-reset-crypto", () => {
  const key = "test-secret-key-for-reset";

  it("encrypts and decrypts user payload", () => {
    const payload = {
      sid: "550e8400-e29b-41d4-a716-446655440000",
      kind: "tenant" as const,
      email: "gestor@acme.pt",
      slug: "acme-formacao",
    };
    const blob = encryptPasswordResetUser(payload, key);
    expect(blob).not.toContain("gestor@acme.pt");
    expect(decryptPasswordResetUser(blob, key)).toEqual(payload);
  });

  it("masks email for hints", () => {
    expect(maskEmail("gestor@acme.pt")).toBe("ge***@acme.pt");
  });
});
