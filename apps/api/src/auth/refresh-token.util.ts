import { createHash, randomBytes } from "node:crypto";

export function newRefreshOpaqueToken(): string {
  return randomBytes(48).toString("base64url");
}

export function hashRefreshToken(pepper: string, opaque: string): string {
  return createHash("sha256").update(pepper, "utf8").update(opaque, "utf8").digest("hex");
}
