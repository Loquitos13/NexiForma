-- Tipo de financiamento da acção (DTP financiada vs autofinanciada)

DO $$ BEGIN
  CREATE TYPE "public"."TipoFinanciamentoAcao" AS ENUM ('FINANCIADA', 'AUTO_FINANCIADA');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "public"."acoes_formacao"
  ADD COLUMN IF NOT EXISTS "tipo_financiamento" "public"."TipoFinanciamentoAcao" NOT NULL DEFAULT 'AUTO_FINANCIADA';
