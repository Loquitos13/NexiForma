ALTER TABLE "public"."formandos"
  ADD COLUMN IF NOT EXISTS "gov_auth_verified_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "gov_auth_attributes" JSONB;

CREATE TABLE IF NOT EXISTS "public"."rgpd_consents" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "terms_version" TEXT NOT NULL,
  "user_accepted" BOOLEAN,
  "user_decided_at" TIMESTAMPTZ,
  "admin_status" TEXT NOT NULL DEFAULT 'PENDING',
  "admin_reviewed_at" TIMESTAMPTZ,
  "admin_reviewed_by" UUID,
  "admin_notes" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "rgpd_consents_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "rgpd_consents_user_id_key" UNIQUE ("user_id")
);

CREATE INDEX IF NOT EXISTS "rgpd_consents_tenant_id_idx" ON "public"."rgpd_consents"("tenant_id");
CREATE INDEX IF NOT EXISTS "rgpd_consents_admin_status_idx" ON "public"."rgpd_consents"("admin_status");

ALTER TABLE "public"."rgpd_consents"
  ADD CONSTRAINT "rgpd_consents_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "control_plane"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."rgpd_consents"
  ADD CONSTRAINT "rgpd_consents_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
