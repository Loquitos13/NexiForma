import { createHash, randomBytes } from "node:crypto";

export function hashInviteToken(pepper: string, raw: string): string {
  return createHash("sha256").update(`${pepper}:${raw}`).digest("hex");
}

export function newInviteOpaqueToken(): string {
  return randomBytes(32).toString("hex");
}

export function invitePepperFromConfig(
  get: (key: string) => string | undefined,
  getOrThrow: (key: string) => string,
): string {
  return get("INVITE_TOKEN_PEPPER") ?? `${getOrThrow("JWT_SECRET")}:invite`;
}
