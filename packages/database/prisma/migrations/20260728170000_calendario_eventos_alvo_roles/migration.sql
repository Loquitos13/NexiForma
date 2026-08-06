ALTER TABLE "public"."calendario_eventos"
  ADD COLUMN IF NOT EXISTS "alvo_roles" JSONB NOT NULL DEFAULT '[]';
