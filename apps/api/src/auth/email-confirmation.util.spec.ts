import {
  EMAIL_CONFIRMATION_TTL_MS,
  emailConfirmationPepperFromConfig,
  hashEmailConfirmationToken,
  newEmailConfirmationOpaque,
} from "./email-confirmation.util";

describe("email-confirmation.util", () => {
  it("hashes token with pepper (SHA-256 hex)", () => {
    const hash = hashEmailConfirmationToken("pepper", "raw-token-value");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain("raw-token-value");
    expect(hash).not.toEqual(hashEmailConfirmationToken("other", "raw-token-value"));
  });

  it("generates opaque raw token and matching hash", () => {
    const { raw, hash } = newEmailConfirmationOpaque("pepper");
    expect(raw.length).toBeGreaterThanOrEqual(32);
    expect(hash).toBe(hashEmailConfirmationToken("pepper", raw));
  });

  it("prefers EMAIL_CONFIRM_TOKEN_PEPPER over JWT_SECRET fallback", () => {
    const pepper = emailConfirmationPepperFromConfig(
      (k) => (k === "EMAIL_CONFIRM_TOKEN_PEPPER" ? "custom-pepper" : undefined),
      () => "jwt-secret",
    );
    expect(pepper).toBe("custom-pepper");
  });

  it("falls back to JWT_SECRET:email-confirm", () => {
    const pepper = emailConfirmationPepperFromConfig(
      () => undefined,
      (k) => {
        if (k === "JWT_SECRET") return "jwt-secret-value";
        throw new Error(`missing ${k}`);
      },
    );
    expect(pepper).toBe("jwt-secret-value:email-confirm");
  });

  it("default TTL is 48h", () => {
    expect(EMAIL_CONFIRMATION_TTL_MS).toBe(48 * 60 * 60 * 1000);
  });
});
