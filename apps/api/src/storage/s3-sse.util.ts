/** Opções SSE para PutObject S3 (AES256 ou KMS). */

export type S3SseAlgorithm = "AES256" | "aws:kms";

export type S3SsePutOptions = {
  ServerSideEncryption: S3SseAlgorithm;
  SSEKMSKeyId?: string;
};

export function resolveS3SsePutOptions(env: {
  S3_SSE_ALGORITHM?: string | null;
  S3_KMS_KEY_ID?: string | null;
}): S3SsePutOptions {
  const raw = (env.S3_SSE_ALGORITHM ?? "AES256").trim().toLowerCase();
  if (raw === "aws:kms" || raw === "kms") {
    const keyId = env.S3_KMS_KEY_ID?.trim();
    if (!keyId) {
      throw new Error("S3_KMS_KEY_ID é obrigatório quando S3_SSE_ALGORITHM=aws:kms.");
    }
    return { ServerSideEncryption: "aws:kms", SSEKMSKeyId: keyId };
  }
  if (raw && raw !== "aes256" && raw !== "aes-256") {
    throw new Error(`S3_SSE_ALGORITHM inválido: ${env.S3_SSE_ALGORITHM} (use AES256 ou aws:kms).`);
  }
  return { ServerSideEncryption: "AES256" };
}
