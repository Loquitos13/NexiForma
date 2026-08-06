import type { TenantUserRole } from "@nexiforma/database";
import type { JwtRole } from "@nexiforma/shared";

export const CALENDARIO_ALVO_ROLES = [
  "COMERCIAL",
  "FORMANDO",
  "FORMADOR",
  "COORDENADOR",
  "ADMIN",
  "FINANCEIRO",
] as const satisfies readonly TenantUserRole[];

export type CalendarioAlvoRole = (typeof CALENDARIO_ALVO_ROLES)[number];

export function parseAlvoUserIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string");
}

export function parseAlvoRoles(raw: unknown): CalendarioAlvoRole[] {
  if (!Array.isArray(raw)) return [];
  const allowed = new Set<string>(CALENDARIO_ALVO_ROLES);
  return raw.filter(
    (x): x is CalendarioAlvoRole => typeof x === "string" && allowed.has(x),
  );
}

export function userPodeVerCalendarioEvento(
  user: { sub?: string | null; role: JwtRole },
  userPrismaRole: TenantUserRole | null,
  row: { criadoPorUserId: string; alvoUserIds: unknown; alvoRoles?: unknown },
): boolean {
  if (user.role === "tenant_manager" || user.role === "super_admin") return true;
  if (user.sub && row.criadoPorUserId === user.sub) return true;

  const alvos = parseAlvoUserIds(row.alvoUserIds);
  if (user.sub && alvos.includes(user.sub)) return true;

  const roles = parseAlvoRoles(row.alvoRoles);
  if (userPrismaRole && roles.includes(userPrismaRole as CalendarioAlvoRole)) {
    return true;
  }

  return false;
}

export function userPodeEditarCalendarioEvento(
  user: { sub?: string | null; role: JwtRole },
  row: { criadoPorUserId: string },
): boolean {
  if (user.role === "tenant_manager" || user.role === "super_admin") return true;
  return !!user.sub && row.criadoPorUserId === user.sub;
}

export function eventoSemDestinatarios(row: {
  alvoUserIds: unknown;
  alvoRoles?: unknown;
}): boolean {
  return parseAlvoUserIds(row.alvoUserIds).length === 0 && parseAlvoRoles(row.alvoRoles).length === 0;
}
