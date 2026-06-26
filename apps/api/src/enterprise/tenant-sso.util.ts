export type TenantSsoConfig = {
  enabled: boolean;
  providerLabel?: string;
  issuer: string;
  clientId: string;
  clientSecretEnc?: string;
  scopes?: string[];
};

export type TenantMetadataWithSso = {
  branding?: Record<string, unknown>;
  cronograma?: Record<string, unknown>;
  sso?: TenantSsoConfig;
};

export function readTenantSso(metadata: unknown): TenantSsoConfig | null {
  const meta = (metadata ?? {}) as TenantMetadataWithSso;
  const sso = meta.sso;
  if (!sso?.enabled || !sso.issuer?.trim() || !sso.clientId?.trim()) {
    return null;
  }
  return sso;
}

export function sanitizeSsoForClient(sso: TenantSsoConfig | null) {
  if (!sso) {
    return { enabled: false as const };
  }
  return {
    enabled: true as const,
    providerLabel: sso.providerLabel ?? "OpenID Connect",
    issuer: sso.issuer,
    clientId: sso.clientId,
    scopes: sso.scopes ?? ["openid", "profile", "email"],
    hasClientSecret: Boolean(sso.clientSecretEnc),
  };
}
