import { createHash, randomBytes } from "node:crypto";

export function hashPasswordResetToken(pepper: string, raw: string): string {
  return createHash("sha256").update(`${pepper}:${raw}`).digest("hex");
}

export function newPasswordResetOpaque(pepper: string): { raw: string; hash: string } {
  const raw = randomBytes(32).toString("base64url");
  return { raw, hash: hashPasswordResetToken(pepper, raw) };
}
