-- Fase 5: exports S3 + Teams meeting id
CREATE TYPE "ExportArquivoTipo" AS ENUM ('DOSSIE_JSON', 'SIGO_JSON', 'DOSSIE_HTML');

ALTER TABLE "public"."sessoes_formacao" ADD COLUMN "teams_meeting_id" TEXT;

CREATE TABLE "public"."arquivos_exportacao" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "acao_formacao_id" UUID NOT NULL,
    "tipo" "ExportArquivoTipo" NOT NULL,
    "storage_key" TEXT NOT NULL,
    "nome_ficheiro" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "tamanho_bytes" INTEGER NOT NULL,
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "arquivos_exportacao_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "public"."arquivos_exportacao" ADD CONSTRAINT "arquivos_exportacao_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "control_plane"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."arquivos_exportacao" ADD CONSTRAINT "arquivos_exportacao_acao_formacao_id_fkey" FOREIGN KEY ("acao_formacao_id") REFERENCES "public"."acoes_formacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."arquivos_exportacao" ADD CONSTRAINT "arquivos_exportacao_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "arquivos_exportacao_tenant_id_acao_formacao_id_idx" ON "public"."arquivos_exportacao"("tenant_id", "acao_formacao_id");
