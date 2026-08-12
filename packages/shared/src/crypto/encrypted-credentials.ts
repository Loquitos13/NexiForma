export type EncryptedCredentialPayload = {
  ciphertext: string;
  iv: string;
  tag: string;
  algorithm: "AES-256-GCM";
};

export type DecryptedCredentialData = {
  userId: string;
  email: string;
  displayName: string | null;
  tenantSlug: string;
  temporaryPassword: string;
  mustChangePassword: boolean;
  revokedAt: string;
  revokedBy: string;
};
