-- Configuração SIGO por entidade formadora (credenciais + perfis de acesso)
CREATE TABLE "public"."config_sigo_tenant" (
    "tenant_id" UUID NOT NULL,
    "integracao_ativa" BOOLEAN NOT NULL DEFAULT false,
    "nif_entidade" TEXT NOT NULL,
    "codigo_entidade" TEXT,
    "denominacao_entidade" TEXT,
    "api_key_enc" TEXT,
    "base_url_override" TEXT,
    "perfis_acesso" JSONB NOT NULL DEFAULT '{}',
    "ultimo_teste_ok_em" TIMESTAMP(3),
    "ultimo_teste_msg" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "config_sigo_tenant_pkey" PRIMARY KEY ("tenant_id")
);

ALTER TABLE "public"."config_sigo_tenant" ADD CONSTRAINT "config_sigo_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "control_plane"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
