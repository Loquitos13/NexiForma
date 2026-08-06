import { createVerify } from "node:crypto";
import { Logger } from "@nestjs/common";

const logger = new Logger("SnsSignature");

const ALLOWED_CERT_HOST = /^sns\.[a-z0-9-]+\.amazonaws\.com$/i;

type SnsMessage = Record<string, string | undefined>;

/** Campos incluídos na assinatura SNS (ordem AWS). */
const SNS_SIGNABLE_KEYS = [
  "Message",
  "MessageId",
  "Subject",
  "SubscribeURL",
  "Timestamp",
  "Token",
  "TopicArn",
  "Type",
] as const;

function buildStringToSign(msg: SnsMessage): string {
  const lines: string[] = [];
  for (const key of SNS_SIGNABLE_KEYS) {
    const val = msg[key];
    if (val !== undefined && val !== "") {
      lines.push(`${key}\n${val}\n`);
    }
  }
  return lines.join("");
}

function isAllowedCertUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && ALLOWED_CERT_HOST.test(u.hostname);
  } catch {
    return false;
  }
}

export async function verifySnsMessageSignature(body: SnsMessage): Promise<boolean> {
  const signature = body.Signature;
  const certUrl = body.SigningCertURL;
  const sigVersion = body.SignatureVersion;

  if (!signature || !certUrl || sigVersion !== "1") {
    return false;
  }
  if (!isAllowedCertUrl(certUrl)) {
    logger.warn("SigningCertURL SNS não permitido.");
    return false;
  }

  const res = await fetch(certUrl, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) return false;
  const pem = await res.text();
  if (!pem.includes("BEGIN CERTIFICATE")) return false;

  const verifier = createVerify("RSA-SHA1");
  verifier.update(buildStringToSign(body));
  return verifier.verify(pem, signature, "base64");
}
