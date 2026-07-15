import type { TenantUserRole } from "@nexiforma/database";
import type { JwtRole } from "@nexiforma/shared";

const GESTOR_PRISMA_ROLES = new Set<TenantUserRole>(["ADMIN", "COORDENADOR"]);
const REUNIAO_AUDIENCIA_ROLES = [
  "COMERCIAL",
  "FORMADOR",
  "FINANCEIRO",
  "COORDENADOR",
] as const satisfies readonly TenantUserRole[];

export type ReuniaoAudienciaRole = (typeof REUNIAO_AUDIENCIA_ROLES)[number];

export function parseParticipantes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string");
}

export function parseAudienciaRoles(raw: unknown): TenantUserRole[] {
  if (!Array.isArray(raw)) return [];
  const allowed = new Set<string>(REUNIAO_AUDIENCIA_ROLES);
  return raw.filter((x): x is TenantUserRole => typeof x === "string" && allowed.has(x));
}

export function userPodeVerReuniao(
  user: { sub?: string | null; role: JwtRole },
  userPrismaRole: TenantUserRole | null,
  row: {
    criadoPorUserId: string;
    participantesIds: unknown;
    audienciaRoles: unknown;
  },
): boolean {
  if (user.role === "super_admin") return true;
  if (userPrismaRole && GESTOR_PRISMA_ROLES.has(userPrismaRole)) return true;
  if (user.sub && row.criadoPorUserId === user.sub) return true;

  const participantes = parseParticipantes(row.participantesIds);
  if (user.sub && participantes.includes(user.sub)) return true;

  const audiencia = parseAudienciaRoles(row.audienciaRoles);
  if (userPrismaRole && audiencia.includes(userPrismaRole)) return true;

  return false;
}
