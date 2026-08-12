import * as crypto from "crypto";
import type { DecryptedCredentialData, EncryptedCredentialPayload } from "@nexiforma/shared";

export function encryptCredentialsWithSecret(
  data: DecryptedCredentialData,
  secret: string,
): EncryptedCredentialPayload {
  const key = crypto.createHash("sha256").update(secret).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  const text = JSON.stringify(data);
  let ciphertext = cipher.update(text, "utf8", "hex");
  ciphertext += cipher.final("hex");
  const tag = cipher.getAuthTag().toString("hex");

  return {
    ciphertext,
    iv: iv.toString("hex"),
    tag,
    algorithm: "AES-256-GCM",
  };
}

export function decryptCredentialsWithSecret(
  payload: EncryptedCredentialPayload,
  secret: string,
): DecryptedCredentialData | null {
  try {
    const key = crypto.createHash("sha256").update(secret).digest();
    const iv = Buffer.from(payload.iv, "hex");
    const tag = Buffer.from(payload.tag, "hex");
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(payload.ciphertext, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return JSON.parse(decrypted) as DecryptedCredentialData;
  } catch {
    return null;
  }
}
