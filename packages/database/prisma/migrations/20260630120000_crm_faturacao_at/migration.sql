-- Fase 10B.1: CRM faturação (rascunhos, séries, linhas IVA)

CREATE TYPE "FaturaEstado" AS ENUM ('RASCUNHO', 'EMITIDA', 'COMUNICADA_AT', 'ANULADA');
CREATE TYPE "SerieFaturacaoTipo" AS ENUM ('FT', 'FS', 'NC');

CREATE TABLE "public"."config_faturacao_tenant" (
  "tenant_id" UUID NOT NULL,
  "nif_emitente" TEXT NOT NULL,
  "regime_iva" TEXT NOT NULL DEFAULT 'NORMAL',
  "serie_padrao_codigo" TEXT NOT NULL DEFAULT '2026',
  "taxa_iva_padrao" DECIMAL(5,2) NOT NULL DEFAULT 23,
  "at_subutilizador" TEXT,
  "at_certificado_ref" TEXT,
  "software_certificado" TEXT,
  "comunicacao_ativa" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "config_faturacao_tenant_pkey" PRIMARY KEY ("tenant_id")
);

CREATE TABLE "public"."series_faturacao" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "codigo" TEXT NOT NULL,
  "tipo" "SerieFaturacaoTipo" NOT NULL DEFAULT 'FT',
  "proximo_numero" INTEGER NOT NULL DEFAULT 1,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "series_faturacao_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."faturas_comerciais" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "entidade_cliente_id" UUID NOT NULL,
  "proposta_id" UUID,
  "serie_id" UUID NOT NULL,
  "numero" INTEGER,
  "codigo_atcud" TEXT,
  "estado" "FaturaEstado" NOT NULL DEFAULT 'RASCUNHO',
  "data_emissao" TIMESTAMP(3),
  "data_vencimento" DATE,
  "valor_centavos" INTEGER NOT NULL DEFAULT 0,
  "iva_centavos" INTEGER NOT NULL DEFAULT 0,
  "moeda" CHAR(3) NOT NULL DEFAULT 'EUR',
  "notas" TEXT,
  "emitida_por_user_id" UUID,
  "anulada_em" TIMESTAMP(3),
  "motivo_anulacao" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "faturas_comerciais_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."faturas_linhas" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "fatura_id" UUID NOT NULL,
  "ordem" INTEGER NOT NULL DEFAULT 1,
  "descricao" TEXT NOT NULL,
  "quantidade" DECIMAL(12,4) NOT NULL DEFAULT 1,
  "preco_unit_centavos" INTEGER NOT NULL,
  "taxa_iva" DECIMAL(5,2) NOT NULL,
  "valor_iva_centavos" INTEGER NOT NULL,
  CONSTRAINT "faturas_linhas_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."faturas_comunicacoes_at" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "fatura_id" UUID NOT NULL,
  "tentativa_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sucesso" BOOLEAN NOT NULL,
  "codigo_resposta" TEXT,
  "mensagem_at" TEXT,
  "payload_hash" TEXT,
  CONSTRAINT "faturas_comunicacoes_at_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "faturas_comerciais_proposta_id_key" ON "public"."faturas_comerciais"("proposta_id");
CREATE INDEX "faturas_comerciais_tenant_id_idx" ON "public"."faturas_comerciais"("tenant_id");
CREATE INDEX "faturas_comerciais_entidade_cliente_id_idx" ON "public"."faturas_comerciais"("entidade_cliente_id");
CREATE INDEX "faturas_comerciais_estado_idx" ON "public"."faturas_comerciais"("estado");
CREATE UNIQUE INDEX "series_faturacao_tenant_id_codigo_tipo_key" ON "public"."series_faturacao"("tenant_id", "codigo", "tipo");
CREATE INDEX "series_faturacao_tenant_id_idx" ON "public"."series_faturacao"("tenant_id");
CREATE INDEX "faturas_linhas_fatura_id_idx" ON "public"."faturas_linhas"("fatura_id");
CREATE INDEX "faturas_comunicacoes_at_fatura_id_idx" ON "public"."faturas_comunicacoes_at"("fatura_id");

ALTER TABLE "public"."config_faturacao_tenant"
  ADD CONSTRAINT "config_faturacao_tenant_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "control_plane"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."series_faturacao"
  ADD CONSTRAINT "series_faturacao_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "control_plane"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."faturas_comerciais"
  ADD CONSTRAINT "faturas_comerciais_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "control_plane"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."faturas_comerciais"
  ADD CONSTRAINT "faturas_comerciais_entidade_cliente_id_fkey"
  FOREIGN KEY ("entidade_cliente_id") REFERENCES "public"."entidades_cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."faturas_comerciais"
  ADD CONSTRAINT "faturas_comerciais_proposta_id_fkey"
  FOREIGN KEY ("proposta_id") REFERENCES "public"."propostas_comerciais"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."faturas_comerciais"
  ADD CONSTRAINT "faturas_comerciais_serie_id_fkey"
  FOREIGN KEY ("serie_id") REFERENCES "public"."series_faturacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public"."faturas_comerciais"
  ADD CONSTRAINT "faturas_comerciais_emitida_por_user_id_fkey"
  FOREIGN KEY ("emitida_por_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."faturas_linhas"
  ADD CONSTRAINT "faturas_linhas_fatura_id_fkey"
  FOREIGN KEY ("fatura_id") REFERENCES "public"."faturas_comerciais"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."faturas_comunicacoes_at"
  ADD CONSTRAINT "faturas_comunicacoes_at_fatura_id_fkey"
  FOREIGN KEY ("fatura_id") REFERENCES "public"."faturas_comerciais"("id") ON DELETE CASCADE ON UPDATE CASCADE;
