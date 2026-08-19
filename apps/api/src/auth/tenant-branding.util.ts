export type TenantMetadataBranding = {
  logoUrl?: string;
  logoStorageKey?: string;
  companyName?: string;
  signatureStorageKey?: string;
  signatureResponsibleName?: string;
};

/** 1–2 iniciais a partir do nome da entidade (ex.: "Demonstração NexiForma" → "DN"). */
export function tenantDisplayInitials(name: string): string {
  const cleaned = name.trim().replace(/\s+/g, " ");
  if (!cleaned) return "?";

  const words = cleaned.split(" ").filter((word) => /[\p{L}\p{N}]/u.test(word));
  if (words.length === 0) {
    return cleaned.slice(0, 2).toUpperCase() || "?";
  }
  if (words.length === 1) {
    const letters = words[0].replace(/[^\p{L}\p{N}]/gu, "");
    return (letters.slice(0, 2) || "?").toUpperCase();
  }

  const first = words[0].replace(/[^\p{L}\p{N}]/gu, "")[0] ?? "";
  const second = words[1].replace(/[^\p{L}\p{N}]/gu, "")[0] ?? "";
  return (first + second).toUpperCase() || "?";
}

export function publicTenantLogoPath(slug: string): string {
  return `/api/v1/auth/public/tenant-logo?slug=${encodeURIComponent(slug.trim())}`;
}

export function resolveTenantPublicBranding(
  metadata: unknown,
  legalName: string,
  slug: string,
): { displayName: string; logoUrl?: string; initials: string } {
  const meta = (metadata ?? {}) as { branding?: TenantMetadataBranding };
  const branding = meta.branding ?? {};
  const displayName = branding.companyName?.trim() || legalName.trim() || slug.trim();
  let logoUrl: string | undefined;

  if (branding.logoStorageKey?.trim()) {
    logoUrl = publicTenantLogoPath(slug);
  } else {
    const external = branding.logoUrl?.trim();
    if (external && /^https?:\/\//i.test(external)) {
      logoUrl = external;
    }
  }

  return {
    displayName,
    logoUrl,
    initials: tenantDisplayInitials(displayName),
  };
}

export function readTenantLogoStorageKey(metadata: unknown): string | null {
  const meta = (metadata ?? {}) as { branding?: TenantMetadataBranding };
  const key = meta.branding?.logoStorageKey?.trim();
  return key || null;
}

export function readTenantSignatureStorageKey(metadata: unknown): string | null {
  const meta = (metadata ?? {}) as { branding?: TenantMetadataBranding };
  const key = meta.branding?.signatureStorageKey?.trim();
  return key || null;
}

export function readTenantSignatureResponsibleName(metadata: unknown): string {
  const meta = (metadata ?? {}) as { branding?: TenantMetadataBranding };
  return meta.branding?.signatureResponsibleName?.trim() ?? "";
}
