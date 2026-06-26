/** RBAC mínimo para Edge middleware (sem importar @nexiforma/shared). */
export type MiddlewareJwtRole =
  | "super_admin"
  | "tenant_manager"
  | "comercial"
  | "formador"
  | "formando";

export type MiddlewareJwtKind = "platform" | "tenant";

export type MiddlewareJwtSlice = {
  role?: MiddlewareJwtRole;
  kind?: MiddlewareJwtKind;
  impersonating?: boolean;
};

function isSuperAdmin(
  role: MiddlewareJwtRole | null | undefined,
  kind: MiddlewareJwtKind | null | undefined,
): boolean {
  return role === "super_admin" && (kind === undefined || kind === null || kind === "platform");
}

export function canAccessPlatformArea(
  role: MiddlewareJwtRole | null | undefined,
  kind: MiddlewareJwtKind | null | undefined,
): boolean {
  return isSuperAdmin(role, kind);
}

export function canAccessPortalArea(
  role: MiddlewareJwtRole | null | undefined,
  kind: MiddlewareJwtKind | null | undefined,
  impersonating?: boolean,
): boolean {
  if (!role) return false;
  if (isSuperAdmin(role, kind) && !impersonating) return false;
  if (kind === "platform" && !impersonating) return false;
  return (
    role === "tenant_manager" ||
    role === "comercial" ||
    role === "formador" ||
    role === "formando" ||
    !!impersonating
  );
}
