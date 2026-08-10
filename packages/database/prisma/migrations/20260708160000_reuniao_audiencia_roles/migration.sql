-- Audiência da reunião (só se interaccoes_comerciais já existir).
DO $$
BEGIN
  IF to_regclass('public.interaccoes_comerciais') IS NOT NULL THEN
    ALTER TABLE "public"."interaccoes_comerciais"
      ADD COLUMN IF NOT EXISTS "audiencia_roles" JSONB DEFAULT '[]';
  END IF;
END $$;
