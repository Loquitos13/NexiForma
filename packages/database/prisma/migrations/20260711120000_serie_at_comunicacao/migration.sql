-- Estado comunicação séries à AT (webservice Portaria 195/2020)
CREATE TYPE "public"."SerieAtEstado" AS ENUM ('PENDENTE', 'REGISTADA', 'FINALIZADA', 'ANULADA');

ALTER TABLE "public"."series_faturacao"
  ADD COLUMN IF NOT EXISTS "estado_at" "public"."SerieAtEstado" NOT NULL DEFAULT 'PENDENTE',
  ADD COLUMN IF NOT EXISTS "comunicada_at_em" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "data_inicio_prev_utiliz" DATE,
  ADD COLUMN IF NOT EXISTS "num_inicial_comunicado" INTEGER,
  ADD COLUMN IF NOT EXISTS "mensagem_at_serie" TEXT;

UPDATE "public"."series_faturacao"
SET "estado_at" = 'REGISTADA'
WHERE "codigo_validacao_at" IS NOT NULL AND TRIM("codigo_validacao_at") <> '';
