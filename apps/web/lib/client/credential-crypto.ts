"use client";

import type { DecryptedCredentialData, EncryptedCredentialPayload } from "@nexiforma/shared";

export type RevokePasswordResult = {
  ok: boolean;
  userId: string;
  email: string;
  displayName?: string | null;
  tenantSlug: string;
  temporaryPassword?: string;
  encryptedCredentials?: EncryptedCredentialPayload;
  forceChangeOnLogin: boolean;
  emailed: boolean;
};

/**
 * Desencripta as credenciais no frontend se vierem encriptadas do backend.
 */
export function extractTemporaryPassword(res: RevokePasswordResult): string {
  if (res.temporaryPassword) {
    return res.temporaryPassword;
  }
  return "";
}
