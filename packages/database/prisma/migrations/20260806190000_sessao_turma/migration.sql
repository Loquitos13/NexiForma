-- Sessões passam a pertencer a uma turma (filtro por turma na UI).
ALTER TABLE "public"."sessoes_formacao"
  ADD COLUMN IF NOT EXISTS "turma_id" UUID;

-- Backfill: primeira turma da acção (por código).
UPDATE "public"."sessoes_formacao" AS s
SET "turma_id" = t.id
FROM "public"."cronogramas" AS c
INNER JOIN LATERAL (
  SELECT tu.id
  FROM "public"."turmas" AS tu
  WHERE tu."tenant_id" = c."tenant_id"
    AND tu."acao_formacao_id" = c."acao_formacao_id"
  ORDER BY tu."codigo" ASC
  LIMIT 1
) AS t ON TRUE
WHERE s."cronograma_id" = c.id
  AND s."turma_id" IS NULL;

-- Remover unicidade antiga (cronograma + nº sessão).
ALTER TABLE "public"."sessoes_formacao"
  DROP CONSTRAINT IF EXISTS "sessoes_formacao_cronograma_id_numero_sessao_key";

-- Nova unicidade por turma (NULL turma_id continua a permitir várias linhas em PG).
CREATE UNIQUE INDEX IF NOT EXISTS "sessoes_formacao_cronograma_id_turma_id_numero_sessao_key"
  ON "public"."sessoes_formacao" ("cronograma_id", "turma_id", "numero_sessao");

CREATE INDEX IF NOT EXISTS "sessoes_formacao_turma_id_idx"
  ON "public"."sessoes_formacao" ("turma_id");

ALTER TABLE "public"."sessoes_formacao"
  DROP CONSTRAINT IF EXISTS "sessoes_formacao_turma_id_fkey";

ALTER TABLE "public"."sessoes_formacao"
  ADD CONSTRAINT "sessoes_formacao_turma_id_fkey"
  FOREIGN KEY ("turma_id") REFERENCES "public"."turmas"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
