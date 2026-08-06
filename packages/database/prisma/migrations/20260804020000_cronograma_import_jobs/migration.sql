-- Jobs / rascunhos de importação de cronograma via IA (background).
CREATE TYPE "public"."CronogramaImportJobStatus" AS ENUM (
  'A_PROCESSAR',
  'RASCUNHO',
  'FALHA',
  'APLICADO',
  'DESCARTADO'
);

CREATE TABLE "public"."cronograma_import_jobs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "cronograma_id" UUID NOT NULL,
  "acao_formacao_id" UUID NOT NULL,
  "criado_por_user_id" UUID NOT NULL,
  "status" "public"."CronogramaImportJobStatus" NOT NULL DEFAULT 'A_PROCESSAR',
  "nome_ficheiro" VARCHAR(240),
  "texto_fonte" TEXT,
  "resultado" JSONB,
  "erro" TEXT,
  "progresso" INTEGER NOT NULL DEFAULT 5,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "concluded_at" TIMESTAMP(3),

  CONSTRAINT "cronograma_import_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "cronograma_import_jobs_tenant_id_criado_por_user_id_status_idx"
  ON "public"."cronograma_import_jobs"("tenant_id", "criado_por_user_id", "status");

CREATE INDEX "cronograma_import_jobs_tenant_id_cronograma_id_status_idx"
  ON "public"."cronograma_import_jobs"("tenant_id", "cronograma_id", "status");

CREATE INDEX "cronograma_import_jobs_tenant_id_acao_formacao_id_status_idx"
  ON "public"."cronograma_import_jobs"("tenant_id", "acao_formacao_id", "status");

ALTER TABLE "public"."cronograma_import_jobs"
  ADD CONSTRAINT "cronograma_import_jobs_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "control_plane"."tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."cronograma_import_jobs"
  ADD CONSTRAINT "cronograma_import_jobs_cronograma_id_fkey"
  FOREIGN KEY ("cronograma_id") REFERENCES "public"."cronogramas"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."cronograma_import_jobs"
  ADD CONSTRAINT "cronograma_import_jobs_acao_formacao_id_fkey"
  FOREIGN KEY ("acao_formacao_id") REFERENCES "public"."acoes_formacao"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."cronograma_import_jobs"
  ADD CONSTRAINT "cronograma_import_jobs_criado_por_user_id_fkey"
  FOREIGN KEY ("criado_por_user_id") REFERENCES "public"."users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
