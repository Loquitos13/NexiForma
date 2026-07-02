-- Timestamps de transição de estado em propostas comerciais (métricas de tempo enviada → aceite)
ALTER TABLE "public"."propostas_comerciais"
  ADD COLUMN "enviada_em" TIMESTAMPTZ,
  ADD COLUMN "aceite_em" TIMESTAMPTZ,
  ADD COLUMN "rejeitada_em" TIMESTAMPTZ;

UPDATE "public"."propostas_comerciais"
SET "enviada_em" = "updated_at"
WHERE "estado" IN ('ENVIADA', 'ACEITE', 'REJEITADA', 'CANCELADA')
  AND "enviada_em" IS NULL;

UPDATE "public"."propostas_comerciais"
SET "aceite_em" = "updated_at"
WHERE "estado" = 'ACEITE'
  AND "aceite_em" IS NULL;

UPDATE "public"."propostas_comerciais"
SET "rejeitada_em" = "updated_at"
WHERE "estado" = 'REJEITADA'
  AND "rejeitada_em" IS NULL;
