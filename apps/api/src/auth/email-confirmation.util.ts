import { createHash, randomBytes } from "node:crypto";

export function hashEmailConfirmationToken(pepper: string, raw: string): string {
  return createHash("sha256").update(`${pepper}:${raw}`).digest("hex");
}

export function newEmailConfirmationOpaque(pepper: string): { raw: string; hash: string } {
  const raw = randomBytes(32).toString("base64url");
  return { raw, hash: hashEmailConfirmationToken(pepper, raw) };
}

export function emailConfirmationPepperFromConfig(
  get: (key: string) => string | undefined,
  getOrThrow: (key: string) => string,
): string {
  return get("EMAIL_CONFIRM_TOKEN_PEPPER") ?? `${getOrThrow("JWT_SECRET")}:email-confirm`;
}

/** TTL por omissão: 48 horas. */
export const EMAIL_CONFIRMATION_TTL_MS = 48 * 60 * 60 * 1000;
