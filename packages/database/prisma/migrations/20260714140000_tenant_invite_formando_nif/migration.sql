ALTER TABLE "public"."tenant_invites"
ADD COLUMN IF NOT EXISTS "formando_nif" VARCHAR(9),
ADD COLUMN IF NOT EXISTS "formando_telefone" VARCHAR(48);
