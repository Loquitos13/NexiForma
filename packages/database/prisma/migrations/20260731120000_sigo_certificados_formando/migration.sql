-- Certificados SIGO por formando (sync API DGEEC)
CREATE TYPE "public"."SigoCertificadoEstado" AS ENUM ('PENDENTE', 'DISPONIVEL', 'ERRO');

CREATE TABLE "public"."sigo_certificados_formando" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "acao_formacao_id" UUID NOT NULL,
  "matricula_id" UUID NOT NULL,
  "submissao_id" UUID,
  "sigo_referencia" TEXT NOT NULL,
  "estado" "public"."SigoCertificadoEstado" NOT NULL DEFAULT 'PENDENTE',
  "numero_certificado" TEXT,
  "storage_key" TEXT,
  "mime_type" TEXT DEFAULT 'application/pdf',
  "tamanho_bytes" INTEGER,
  "emitido_em" TIMESTAMP(3),
  "sincronizado_em" TIMESTAMP(3),
  "erros" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sigo_certificados_formando_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sigo_certificados_formando_tenant_id_matricula_id_sigo_referencia_key"
  ON "public"."sigo_certificados_formando"("tenant_id", "matricula_id", "sigo_referencia");

CREATE INDEX "sigo_certificados_formando_tenant_id_acao_formacao_id_idx"
  ON "public"."sigo_certificados_formando"("tenant_id", "acao_formacao_id");

CREATE INDEX "sigo_certificados_formando_submissao_id_idx"
  ON "public"."sigo_certificados_formando"("submissao_id");

ALTER TABLE "public"."sigo_certificados_formando"
  ADD CONSTRAINT "sigo_certificados_formando_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "control_plane"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."sigo_certificados_formando"
  ADD CONSTRAINT "sigo_certificados_formando_acao_formacao_id_fkey"
  FOREIGN KEY ("acao_formacao_id") REFERENCES "public"."acoes_formacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."sigo_certificados_formando"
  ADD CONSTRAINT "sigo_certificados_formando_matricula_id_fkey"
  FOREIGN KEY ("matricula_id") REFERENCES "public"."matriculas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."sigo_certificados_formando"
  ADD CONSTRAINT "sigo_certificados_formando_submissao_id_fkey"
  FOREIGN KEY ("submissao_id") REFERENCES "public"."sigo_submissoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
