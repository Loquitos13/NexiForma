import type { TenantUserRole } from "@nexiforma/database";
import {
  resolverEmailEntregavel,
  resolverEmailNotificacaoFormador,
  resolverEmailUtilizador,
} from "@nexiforma/shared";

/** Gestor de tenant (administração). */
export const GESTOR_ROLES: TenantUserRole[] = ["ADMIN"];

/** Coordenação pedagógica + administração (alertas de formação). */
export const GESTOR_COORDENADOR_ROLES: TenantUserRole[] = [
  "ADMIN",
  "COORDENADOR_PEDAGOGICO",
  "COORDENADOR", // legado
];

/** Gestão + coordenadores + comercial (CRM / website). */
export const GESTOR_E_COMERCIAL_ROLES: TenantUserRole[] = [
  "ADMIN",
  "COORDENADOR_COMERCIAL",
  "COORDENADOR_PEDAGOGICO",
  "COORDENADOR_FINANCEIRO",
  "COORDENADOR", // legado
  "FINANCEIRO", // legado
  "COMERCIAL",
];

export function resolverEmailNotificacaoUtilizador(
  role: TenantUserRole,
  userEmail: string,
  formadorPerfilEmail?: string | null,
  /** Ex.: MAIL_REPLY_TO - usado quando a conta é @demo.local / não entregável. */
  fallbackEntrega?: string | null,
): string | null {
  if (role === "FORMADOR") {
    const formador = resolverEmailNotificacaoFormador({
      emailPerfil: formadorPerfilEmail,
      emailConta: userEmail,
    });
    return resolverEmailEntregavel(formador, fallbackEntrega);
  }
  return resolverEmailEntregavel(
    resolverEmailUtilizador(userEmail),
    fallbackEntrega,
  );
}
