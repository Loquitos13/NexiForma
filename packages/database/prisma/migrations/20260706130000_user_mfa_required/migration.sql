ALTER TABLE "public"."users"
  ADD COLUMN IF NOT EXISTS "mfa_required" BOOLEAN NOT NULL DEFAULT false;
