import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const SALT = "nexiforma-support-ticket-v1";

export type SupportTicketPayload = {
  email: string;
  slug: string;
  subject: string;
  body: string;
  displayName?: string;
  userId?: string;
  role?: string;
};

function deriveKey(secret: string): Buffer {
  return createHash("sha256").update(`${SALT}:${secret}`).digest();
}

export function encryptSupportTicketPayload(
  payload: SupportTicketPayload,
  encryptionKey: string,
): string {
  if (!encryptionKey.trim()) {
    throw new Error("SUPPORT_TICKET_ENCRYPTION_KEY em falta.");
  }
  const key = deriveKey(encryptionKey);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const plaintext = JSON.stringify(payload);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${enc.toString("base64url")}`;
}

export function decryptSupportTicketPayload(
  blob: string,
  encryptionKey: string,
): SupportTicketPayload {
  if (!encryptionKey.trim()) {
    throw new Error("SUPPORT_TICKET_ENCRYPTION_KEY em falta.");
  }
  const [ivB64, tagB64, dataB64] = blob.split(".");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Payload de ticket inválido.");
  }
  const key = deriveKey(encryptionKey);
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64url"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  const json = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64url")),
    decipher.final(),
  ]).toString("utf8");
  const parsed = JSON.parse(json) as SupportTicketPayload;
  if (!parsed?.email || !parsed?.slug || !parsed?.subject || !parsed?.body) {
    throw new Error("Payload de ticket incompleto.");
  }
  return parsed;
}
