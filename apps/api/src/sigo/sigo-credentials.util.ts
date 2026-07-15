import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const SALT = "nexiforma-sigo-api-v1";

function deriveKey(secret: string): Buffer {
  return createHash("sha256").update(`${SALT}:${secret}`).digest();
}

export function encriptarSigoApiKey(plaintext: string, encryptionKey: string): string {
  if (!encryptionKey.trim()) {
    throw new Error("AT_CREDENTIALS_ENCRYPTION_KEY em falta.");
  }
  const key = deriveKey(encryptionKey);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${enc.toString("base64")}`;
}

export function desencriptarSigoApiKey(payload: string, encryptionKey: string): string {
  if (!encryptionKey.trim()) {
    throw new Error("AT_CREDENTIALS_ENCRYPTION_KEY em falta.");
  }
  const [ivB64, tagB64, dataB64] = payload.split(".");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("API key SIGO corrompida.");
  }
  const key = deriveKey(encryptionKey);
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
