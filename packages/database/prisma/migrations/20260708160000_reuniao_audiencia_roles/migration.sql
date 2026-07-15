ALTER TABLE "public"."interaccoes_comerciais"
  ADD COLUMN IF NOT EXISTS "audiencia_roles" JSONB DEFAULT '[]';
