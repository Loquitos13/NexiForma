-- Verificação de email e nome no convite
ALTER TABLE "public"."users" ADD COLUMN IF NOT EXISTS "email_verified_at" TIMESTAMPTZ;
UPDATE "public"."users" SET "email_verified_at" = "created_at" WHERE "email_verified_at" IS NULL;

ALTER TABLE "public"."tenant_invites" ADD COLUMN IF NOT EXISTS "display_name" VARCHAR(120);
