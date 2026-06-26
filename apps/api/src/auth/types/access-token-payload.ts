import type { JwtKind, JwtRole } from "@nexiforma/shared";

/** Payload do access token (HS256). */
export interface AccessTokenPayload {
  sub: string;
  email: string;
  kind: JwtKind;
  role: JwtRole;
  tenantId: string | null;
  tenantSlug: string | null;
  /** Personificação super-admin → utilizador tenant */
  impersonating?: boolean;
  impersonationSessionId?: string;
  readOnlyImpersonation?: boolean;
  jwtJti?: string;
}

export type RequestUser = AccessTokenPayload;
