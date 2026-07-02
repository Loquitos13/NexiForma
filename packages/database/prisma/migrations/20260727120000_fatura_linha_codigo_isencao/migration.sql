ALTER TABLE "public"."faturas_linhas"
  ADD COLUMN IF NOT EXISTS "codigo_isencao_iva" VARCHAR(8);
