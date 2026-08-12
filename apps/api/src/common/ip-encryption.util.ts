import * as crypto from "crypto";

export function isPrivateOrInternalIp(ip: string): boolean {
  const clean = ip.trim().toLowerCase();
  if (clean === "127.0.0.1" || clean === "::1" || clean === "localhost") return true;
  if (clean.startsWith("10.") || clean.startsWith("192.168.")) return true;
  if (clean.startsWith("172.")) {
    const parts = clean.split(".");
    const second = Number(parts[1]);
    if (second >= 16 && second <= 31) return true;
  }
  if (clean.startsWith("fc00:") || clean.startsWith("fe80:")) return true;
  return false;
}

export function maskPublicIp(ip: string): string {
  const clean = ip.trim();
  if (isPrivateOrInternalIp(clean)) {
    return clean;
  }
  if (clean.includes(":")) {
    const parts = clean.split(":");
    if (parts.length <= 2) return clean;
    return `${parts[0]}:****:****:${parts[parts.length - 1]}`;
  }
  const parts = clean.split(".");
  if (parts.length === 4) {
    return `${parts[0]}.***.***.${parts[3]}`;
  }
  return clean.slice(0, 3) + "***";
}

export function encryptIpWithSecret(ip: string, secret: string): string {
  const key = crypto.createHash("sha256").update(secret).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  let enc = cipher.update(ip, "utf8", "hex");
  enc += cipher.final("hex");
  const tag = cipher.getAuthTag().toString("hex");
  return `enc:v1:${iv.toString("hex")}:${tag}:${enc}`;
}

export function decryptIpWithSecret(encrypted: string, secret: string): string | null {
  try {
    if (!encrypted.startsWith("enc:v1:")) return null;
    const [, , ivHex, tagHex, cipherHex] = encrypted.split(":");
    if (!ivHex || !tagHex || !cipherHex) return null;

    const key = crypto.createHash("sha256").update(secret).digest();
    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);

    let dec = decipher.update(cipherHex, "hex", "utf8");
    dec += decipher.final("utf8");
    return dec;
  } catch {
    return null;
  }
}
