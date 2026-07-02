-- Catálogo formações / sync website tenant

CREATE TYPE "public"."InscricoesEstado" AS ENUM ('ABERTAS', 'FECHADAS');

ALTER TABLE "public"."cursos"
  ADD COLUMN "codigo_publico" INTEGER,
  ADD COLUMN "enquadramento" TEXT,
  ADD COLUMN "metodo_ensino" TEXT,
  ADD COLUMN "cover_storage_key" TEXT,
  ADD COLUMN "publicado" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "cursos_tenant_id_codigo_publico_key"
  ON "public"."cursos"("tenant_id", "codigo_publico");

ALTER TABLE "public"."acoes_formacao"
  ADD COLUMN "inscricoes_estado" "public"."InscricoesEstado" NOT NULL DEFAULT 'FECHADAS',
  ADD COLUMN "publicado" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "agenda_template" JSONB;

ALTER TABLE "public"."sessoes_formacao"
  ADD COLUMN "local" TEXT;

-- Atribuir codigo_publico sequencial por tenant aos cursos existentes
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY created_at, id) AS rn
  FROM "public"."cursos"
)
UPDATE "public"."cursos" c
SET codigo_publico = ranked.rn
FROM ranked
WHERE c.id = ranked.id AND c.codigo_publico IS NULL;
