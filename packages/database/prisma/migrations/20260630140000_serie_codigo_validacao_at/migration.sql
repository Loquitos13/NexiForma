ALTER TABLE "public"."series_faturacao"
  ADD COLUMN IF NOT EXISTS "codigo_validacao_at" TEXT;
