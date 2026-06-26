import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const SALT = "nexiforma-at-wfa-v1";

function deriveKey(secret: string): Buffer {
  return createHash("sha256").update(`${SALT}:${secret}`).digest();
}

/** Encripta password WFA para armazenamento em BD (AES-256-GCM). */
export function encriptarPasswordWfa(plaintext: string, encryptionKey: string): string {
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

export function desencriptarPasswordWfa(payload: string, encryptionKey: string): string {
  if (!encryptionKey.trim()) {
    throw new Error("AT_CREDENTIALS_ENCRYPTION_KEY em falta.");
  }
  const [ivB64, tagB64, dataB64] = payload.split(".");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Credencial WFA corrompida.");
  }
  const key = deriveKey(encryptionKey);
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

/** Username WFA: NIF/subutilizador (ex. 123456789/1). */
export function formatarUsernameWfa(nifEmitente: string, subutilizador: string): string {
  const sub = subutilizador.trim();
  if (sub.includes("/")) return sub;
  const nif = nifEmitente.replace(/\D/g, "");
  return `${nif}/${sub}`;
}
