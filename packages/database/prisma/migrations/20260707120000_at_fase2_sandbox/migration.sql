-- Fase 2 AT: comunicação automática, retenções e referência NC
ALTER TABLE "public"."config_faturacao_tenant"
  ADD COLUMN IF NOT EXISTS "comunicacao_automatica" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "public"."faturas_comerciais"
  ADD COLUMN IF NOT EXISTS "retencao_centavos" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "public"."faturas_comerciais"
  ADD COLUMN IF NOT EXISTS "fatura_referencia_id" UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'faturas_comerciais_fatura_referencia_id_fkey'
  ) THEN
    ALTER TABLE "public"."faturas_comerciais"
      ADD CONSTRAINT "faturas_comerciais_fatura_referencia_id_fkey"
      FOREIGN KEY ("fatura_referencia_id")
      REFERENCES "public"."faturas_comerciais"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "faturas_comerciais_fatura_referencia_id_idx"
  ON "public"."faturas_comerciais"("fatura_referencia_id");
