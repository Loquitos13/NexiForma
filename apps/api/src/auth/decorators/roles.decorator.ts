import { SetMetadata } from "@nestjs/common";
import type { JwtRole } from "@nexiforma/shared";

export const ROLES_KEY = "nexiforma_roles";

/** Exige um dos roles JWT (ex.: super_admin, tenant_manager). */
export const Roles = (...roles: JwtRole[]) => SetMetadata(ROLES_KEY, roles);
