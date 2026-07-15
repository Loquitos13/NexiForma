import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const SALT = "nexiforma-password-reset-user-v1";

export type PasswordResetUserPayload = {
  sid: string;
  kind: "tenant" | "platform";
  email: string;
  slug?: string;
};

function deriveKey(secret: string): Buffer {
  return createHash("sha256").update(`${SALT}:${secret}`).digest();
}

export function encryptPasswordResetUser(
  payload: PasswordResetUserPayload,
  encryptionKey: string,
): string {
  if (!encryptionKey.trim()) {
    throw new Error("PASSWORD_RESET_ENCRYPTION_KEY em falta.");
  }
  const key = deriveKey(encryptionKey);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const plaintext = JSON.stringify(payload);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${enc.toString("base64url")}`;
}

export function decryptPasswordResetUser(
  blob: string,
  encryptionKey: string,
): PasswordResetUserPayload {
  if (!encryptionKey.trim()) {
    throw new Error("PASSWORD_RESET_ENCRYPTION_KEY em falta.");
  }
  const [ivB64, tagB64, dataB64] = blob.split(".");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Referência de utilizador inválida.");
  }
  const key = deriveKey(encryptionKey);
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64url"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  const json = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64url")),
    decipher.final(),
  ]).toString("utf8");
  const parsed = JSON.parse(json) as PasswordResetUserPayload;
  if (!parsed?.sid || !parsed?.kind || !parsed?.email) {
    throw new Error("Payload de utilizador inválido.");
  }
  return parsed;
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***";
  const visible = local.length <= 2 ? local[0] ?? "*" : local.slice(0, 2);
  return `${visible}***@${domain}`;
}
