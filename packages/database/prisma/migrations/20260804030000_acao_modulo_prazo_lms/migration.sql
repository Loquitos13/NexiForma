-- Prazos LMS por módulo numa edição (acção de formação).
CREATE TABLE "public"."acao_modulo_prazos_lms" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "acao_formacao_id" UUID NOT NULL,
  "modulo_unidade_id" UUID NOT NULL,
  "prazo_conclusao" DATE NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "acao_modulo_prazos_lms_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "acao_modulo_prazos_lms_acao_formacao_id_modulo_unidade_id_key"
  ON "public"."acao_modulo_prazos_lms"("acao_formacao_id", "modulo_unidade_id");

CREATE INDEX "acao_modulo_prazos_lms_tenant_id_acao_formacao_id_idx"
  ON "public"."acao_modulo_prazos_lms"("tenant_id", "acao_formacao_id");

CREATE INDEX "acao_modulo_prazos_lms_tenant_id_prazo_conclusao_idx"
  ON "public"."acao_modulo_prazos_lms"("tenant_id", "prazo_conclusao");

ALTER TABLE "public"."acao_modulo_prazos_lms"
  ADD CONSTRAINT "acao_modulo_prazos_lms_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "control_plane"."tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."acao_modulo_prazos_lms"
  ADD CONSTRAINT "acao_modulo_prazos_lms_acao_formacao_id_fkey"
  FOREIGN KEY ("acao_formacao_id") REFERENCES "public"."acoes_formacao"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."acao_modulo_prazos_lms"
  ADD CONSTRAINT "acao_modulo_prazos_lms_modulo_unidade_id_fkey"
  FOREIGN KEY ("modulo_unidade_id") REFERENCES "public"."modulos_unidade"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
