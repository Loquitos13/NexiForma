-- Phase 1: convites tenant + MFA TOTP para gestores

ALTER TABLE "public"."users"
  ADD COLUMN IF NOT EXISTS "mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "mfa_secret" TEXT;

CREATE TABLE IF NOT EXISTS "public"."tenant_invites" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "email" TEXT NOT NULL,
  "role" "public"."TenantUserRole" NOT NULL,
  "token_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "accepted_at" TIMESTAMP(3),
  "invited_by_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tenant_invites_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "tenant_invites_token_hash_key" ON "public"."tenant_invites"("token_hash");
CREATE UNIQUE INDEX IF NOT EXISTS "tenant_invites_tenant_id_email_key" ON "public"."tenant_invites"("tenant_id", "email");
CREATE INDEX IF NOT EXISTS "tenant_invites_tenant_id_idx" ON "public"."tenant_invites"("tenant_id");

ALTER TABLE "public"."tenant_invites"
  ADD CONSTRAINT "tenant_invites_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "control_plane"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
