import { randomUUID } from "crypto";

export type TenantUserSignature = {
  id: string;
  userId: string;
  storageKey: string;
  displayName?: string;
  createdAt: string;
};

type BrandingMeta = {
  signatureStorageKey?: string;
  signatureResponsibleName?: string;
  userSignatures?: TenantUserSignature[];
};

export function readTenantUserSignatures(metadata: unknown): TenantUserSignature[] {
  const branding = ((metadata ?? {}) as { branding?: BrandingMeta }).branding;
  const list = branding?.userSignatures ?? [];
  if (list.length > 0) return list;

  const legacyKey = branding?.signatureStorageKey?.trim();
  if (!legacyKey) return [];

  return [
    {
      id: "legacy",
      userId: "",
      storageKey: legacyKey,
      displayName: branding?.signatureResponsibleName?.trim() || undefined,
      createdAt: "",
    },
  ];
}

export function readUserSignatureStorageKey(metadata: unknown, userId: string): string | null {
  const id = userId.trim();
  if (!id) return null;
  const sig = readTenantUserSignatures(metadata).find((s) => s.userId === id);
  return sig?.storageKey?.trim() || null;
}

export function readUserSignatureDisplayName(metadata: unknown, userId: string): string {
  const id = userId.trim();
  if (!id) return "";
  const sig = readTenantUserSignatures(metadata).find((s) => s.userId === id);
  return sig?.displayName?.trim() ?? "";
}

export function findTenantUserSignature(
  metadata: unknown,
  signatureId: string,
): TenantUserSignature | null {
  const id = signatureId.trim();
  if (!id) return null;
  return readTenantUserSignatures(metadata).find((s) => s.id === id) ?? null;
}

export function upsertTenantUserSignature(
  metadata: unknown,
  entry: Omit<TenantUserSignature, "id" | "createdAt"> & { id?: string; createdAt?: string },
): { metadata: unknown; signature: TenantUserSignature } {
  const meta = (metadata ?? {}) as { branding?: BrandingMeta };
  const branding = { ...(meta.branding ?? {}) };
  let list = [...(branding.userSignatures ?? [])];

  if (list.length === 0 && branding.signatureStorageKey?.trim()) {
    list = readTenantUserSignatures(metadata).filter((s) => s.id !== "legacy");
    delete branding.signatureStorageKey;
    delete branding.signatureResponsibleName;
  }

  const now = new Date().toISOString();
  const existingIdx = list.findIndex((s) => s.userId === entry.userId);
  const signature: TenantUserSignature = {
    id: entry.id ?? list[existingIdx]?.id ?? randomUUID(),
    userId: entry.userId,
    storageKey: entry.storageKey,
    displayName: entry.displayName?.trim() || undefined,
    createdAt: entry.createdAt ?? list[existingIdx]?.createdAt ?? now,
  };

  if (existingIdx >= 0) {
    list[existingIdx] = signature;
  } else {
    list.push(signature);
  }

  branding.userSignatures = list;
  return {
    metadata: { ...meta, branding },
    signature,
  };
}

export function removeTenantUserSignature(
  metadata: unknown,
  signatureId: string,
): { metadata: unknown; removed: TenantUserSignature | null } {
  const meta = (metadata ?? {}) as { branding?: BrandingMeta };
  const branding = { ...(meta.branding ?? {}) };
  const list = readTenantUserSignatures(metadata);
  const removed = list.find((s) => s.id === signatureId) ?? null;
  if (!removed) {
    return { metadata, removed: null };
  }

  if (removed.id === "legacy") {
    delete branding.signatureStorageKey;
    delete branding.signatureResponsibleName;
    branding.userSignatures = [];
  } else {
    branding.userSignatures = (branding.userSignatures ?? []).filter((s) => s.id !== signatureId);
  }

  return { metadata: { ...meta, branding }, removed };
}
