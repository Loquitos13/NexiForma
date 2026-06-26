import type { JwtKind, JwtRole } from "@nexiforma/shared";
import {
  isFormando as sharedIsFormando,
  isTenantStaff,
  resolvePostLoginPath as resolvePath,
} from "@nexiforma/shared";

export type JwtPayloadSlice = {
  role?: JwtRole;
  kind?: JwtKind;
  impersonating?: boolean;
};

export function decodeJwtPayload(accessToken: string | null | undefined): JwtPayloadSlice | null {
  if (!accessToken) return null;
  const parts = accessToken.split(".");
  if (parts.length < 2) return null;
  try {
    const json = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json) as JwtPayloadSlice;
  } catch {
    return null;
  }
}

export function decodeJwtRole(accessToken: string | null | undefined): JwtRole | null {
  return decodeJwtPayload(accessToken)?.role ?? null;
}

export function decodeJwtKind(accessToken: string | null | undefined): JwtKind | null {
  return decodeJwtPayload(accessToken)?.kind ?? null;
}

export function isFormandoRole(role: JwtRole | null): boolean {
  return sharedIsFormando(role ?? undefined);
}

export function isBackofficeRole(role: JwtRole | null): boolean {
  return isTenantStaff(role ?? undefined);
}

export function resolvePostLoginPath(
  accessToken: string | null | undefined,
  next: string | null | undefined,
): string {
  const payload = decodeJwtPayload(accessToken);
  return resolvePath(payload?.role, payload?.kind, next);
}
