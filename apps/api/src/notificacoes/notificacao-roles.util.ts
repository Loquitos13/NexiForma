import type { TenantUserRole } from "@nexiforma/database";
import {
  resolverEmailNotificacaoFormador,
  resolverEmailUtilizador,
} from "@nexiforma/shared";

/** Gestor de tenant (administração, coordenação, financeiro). */
export const GESTOR_ROLES: TenantUserRole[] = ["ADMIN", "COORDENADOR", "FINANCEIRO"];

/** Coordenação + administração (alertas operacionais). */
export const GESTOR_COORDENADOR_ROLES: TenantUserRole[] = ["ADMIN", "COORDENADOR"];

/** Gestão + comercial (formações website, CRM). */
export const GESTOR_E_COMERCIAL_ROLES: TenantUserRole[] = [
  ...GESTOR_ROLES,
  "COMERCIAL",
];

export function resolverEmailNotificacaoUtilizador(
  role: TenantUserRole,
  userEmail: string,
  formadorPerfilEmail?: string | null,
): string | null {
  if (role === "FORMADOR") {
    return resolverEmailNotificacaoFormador({
      emailPerfil: formadorPerfilEmail,
      emailConta: userEmail,
    });
  }
  return resolverEmailUtilizador(userEmail);
}
