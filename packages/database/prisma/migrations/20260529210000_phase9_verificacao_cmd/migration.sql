-- Fase 9: certificado verificável (QR) + assinatura CMD em sumários

ALTER TABLE "public"."sumarios"
  ADD COLUMN IF NOT EXISTS "assinatura_tipo" TEXT DEFAULT 'interna',
  ADD COLUMN IF NOT EXISTS "assinatura_metadata" JSONB;

CREATE TABLE IF NOT EXISTS "public"."certificados_verificacao" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "matricula_id" UUID NOT NULL,
  "codigo_publico" TEXT NOT NULL,
  "token_hash" TEXT NOT NULL,
  "hash_conteudo" TEXT NOT NULL,
  "emitido_por_user_id" UUID,
  "emitido_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revogado_em" TIMESTAMP(3),
  CONSTRAINT "certificados_verificacao_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "certificados_verificacao_codigo_publico_key"
  ON "public"."certificados_verificacao"("codigo_publico");
CREATE UNIQUE INDEX IF NOT EXISTS "certificados_verificacao_token_hash_key"
  ON "public"."certificados_verificacao"("token_hash");
CREATE UNIQUE INDEX IF NOT EXISTS "certificados_verificacao_tenant_id_matricula_id_key"
  ON "public"."certificados_verificacao"("tenant_id", "matricula_id");
CREATE INDEX IF NOT EXISTS "certificados_verificacao_tenant_id_idx"
  ON "public"."certificados_verificacao"("tenant_id");

ALTER TABLE "public"."certificados_verificacao"
  ADD CONSTRAINT "certificados_verificacao_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "control_plane"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."certificados_verificacao"
  ADD CONSTRAINT "certificados_verificacao_matricula_id_fkey"
  FOREIGN KEY ("matricula_id") REFERENCES "public"."matriculas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
