-- SIGO SOAP: credenciais por tenant + histórico de sincronização por formando
CREATE TYPE "public"."SigoRegiaoPortal" AS ENUM ('CONTINENTE', 'MADEIRA', 'ACORES');
CREATE TYPE "public"."SigoSyncEstado" AS ENUM ('PENDENTE', 'SUCESSO', 'ERRO', 'DUPLICADO');

ALTER TABLE "public"."config_sigo_tenant"
  ADD COLUMN "protocolo" TEXT NOT NULL DEFAULT 'soap',
  ADD COLUMN "wsdl_url" TEXT,
  ADD COLUMN "soap_endpoint" TEXT,
  ADD COLUMN "soap_username" TEXT,
  ADD COLUMN "soap_password_enc" TEXT,
  ADD COLUMN "ip_autorizado" TEXT,
  ADD COLUMN "regiao_portal" "public"."SigoRegiaoPortal" NOT NULL DEFAULT 'CONTINENTE';

CREATE TABLE "public"."sigo_sincronizacoes_formando" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "submissao_id" UUID NOT NULL,
    "matricula_id" UUID NOT NULL,
    "operacao" TEXT NOT NULL,
    "transacao_id" TEXT,
    "estado" "public"."SigoSyncEstado" NOT NULL DEFAULT 'PENDENTE',
    "soap_fault_code" TEXT,
    "soap_fault_string" TEXT,
    "request_hash" TEXT,
    "response_resumo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sigo_sincronizacoes_formando_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sigo_sincronizacoes_formando_tenant_sub_mat_op_key"
  ON "public"."sigo_sincronizacoes_formando"("tenant_id", "submissao_id", "matricula_id", "operacao");

CREATE INDEX "sigo_sincronizacoes_formando_submissao_idx"
  ON "public"."sigo_sincronizacoes_formando"("submissao_id");

ALTER TABLE "public"."sigo_sincronizacoes_formando" ADD CONSTRAINT "sigo_sincronizacoes_formando_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "control_plane"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."sigo_sincronizacoes_formando" ADD CONSTRAINT "sigo_sincronizacoes_formando_submissao_id_fkey"
  FOREIGN KEY ("submissao_id") REFERENCES "public"."sigo_submissoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."sigo_sincronizacoes_formando" ADD CONSTRAINT "sigo_sincronizacoes_formando_matricula_id_fkey"
  FOREIGN KEY ("matricula_id") REFERENCES "public"."matriculas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
