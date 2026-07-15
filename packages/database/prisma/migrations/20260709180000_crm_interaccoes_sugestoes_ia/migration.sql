-- CRM inteligente: interacções comerciais + sugestões IA (Ollama local, 0€)

CREATE TYPE "public"."InteraccaoComercialTipo" AS ENUM ('REUNIAO', 'TELEFONE', 'EMAIL', 'NOTA', 'OUTRO');
CREATE TYPE "public"."InteraccaoProcessamentoEstado" AS ENUM ('PENDENTE', 'PROCESSADO', 'ERRO');
CREATE TYPE "public"."SugestaoIaEstado" AS ENUM ('PENDENTE', 'ACEITE', 'REJEITADA');
CREATE TYPE "public"."SugestaoIaTipo" AS ENUM ('UPSELL', 'CROSS_SELL', 'RENOVACAO', 'NOVO_LEAD', 'FOLLOW_UP', 'OUTRO');

ALTER TYPE "public"."LeadOrigem" ADD VALUE 'IA';

CREATE TABLE "public"."interaccoes_comerciais" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "tipo" "public"."InteraccaoComercialTipo" NOT NULL DEFAULT 'REUNIAO',
    "titulo" VARCHAR(200),
    "contexto" TEXT,
    "situacao_actual" TEXT,
    "dor_necessidade" TEXT,
    "orcamento_timing" TEXT,
    "decisor" TEXT,
    "proximo_passo_nota" TEXT,
    "notas_livres" TEXT,
    "resumo_ia" TEXT,
    "proximos_passos_ia" JSONB,
    "gatilhos_ia" JSONB,
    "dados_extraidos_ia" JSONB,
    "processamento_estado" "public"."InteraccaoProcessamentoEstado" NOT NULL DEFAULT 'PENDENTE',
    "processamento_engine" VARCHAR(16),
    "processamento_erro" TEXT,
    "processado_em" TIMESTAMP(3),
    "entidade_cliente_id" UUID,
    "lead_comercial_id" UUID,
    "criado_por_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interaccoes_comerciais_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."sugestoes_ia_comerciais" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "interaccao_id" UUID,
    "entidade_cliente_id" UUID,
    "lead_comercial_id" UUID,
    "tipo" "public"."SugestaoIaTipo" NOT NULL,
    "titulo" VARCHAR(300) NOT NULL,
    "descricao" TEXT NOT NULL,
    "score" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "confianca" DECIMAL(4,3) NOT NULL DEFAULT 0,
    "engine" VARCHAR(16) NOT NULL,
    "metadata" JSONB,
    "estado" "public"."SugestaoIaEstado" NOT NULL DEFAULT 'PENDENTE',
    "motivo_rejeicao" VARCHAR(120),
    "validado_por_user_id" UUID,
    "validado_em" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sugestoes_ia_comerciais_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "interaccoes_comerciais_tenant_id_idx" ON "public"."interaccoes_comerciais"("tenant_id");
CREATE INDEX "interaccoes_comerciais_tenant_id_entidade_cliente_id_idx" ON "public"."interaccoes_comerciais"("tenant_id", "entidade_cliente_id");
CREATE INDEX "interaccoes_comerciais_tenant_id_lead_comercial_id_idx" ON "public"."interaccoes_comerciais"("tenant_id", "lead_comercial_id");
CREATE INDEX "interaccoes_comerciais_tenant_id_processamento_estado_idx" ON "public"."interaccoes_comerciais"("tenant_id", "processamento_estado");

CREATE INDEX "sugestoes_ia_comerciais_tenant_id_idx" ON "public"."sugestoes_ia_comerciais"("tenant_id");
CREATE INDEX "sugestoes_ia_comerciais_tenant_id_estado_idx" ON "public"."sugestoes_ia_comerciais"("tenant_id", "estado");
CREATE INDEX "sugestoes_ia_comerciais_interaccao_id_idx" ON "public"."sugestoes_ia_comerciais"("interaccao_id");

ALTER TABLE "public"."interaccoes_comerciais" ADD CONSTRAINT "interaccoes_comerciais_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "control_plane"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."interaccoes_comerciais" ADD CONSTRAINT "interaccoes_comerciais_entidade_cliente_id_fkey" FOREIGN KEY ("entidade_cliente_id") REFERENCES "public"."entidades_cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."interaccoes_comerciais" ADD CONSTRAINT "interaccoes_comerciais_lead_comercial_id_fkey" FOREIGN KEY ("lead_comercial_id") REFERENCES "public"."leads_comerciais"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."interaccoes_comerciais" ADD CONSTRAINT "interaccoes_comerciais_criado_por_user_id_fkey" FOREIGN KEY ("criado_por_user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public"."sugestoes_ia_comerciais" ADD CONSTRAINT "sugestoes_ia_comerciais_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "control_plane"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."sugestoes_ia_comerciais" ADD CONSTRAINT "sugestoes_ia_comerciais_interaccao_id_fkey" FOREIGN KEY ("interaccao_id") REFERENCES "public"."interaccoes_comerciais"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."sugestoes_ia_comerciais" ADD CONSTRAINT "sugestoes_ia_comerciais_entidade_cliente_id_fkey" FOREIGN KEY ("entidade_cliente_id") REFERENCES "public"."entidades_cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."sugestoes_ia_comerciais" ADD CONSTRAINT "sugestoes_ia_comerciais_lead_comercial_id_fkey" FOREIGN KEY ("lead_comercial_id") REFERENCES "public"."leads_comerciais"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."sugestoes_ia_comerciais" ADD CONSTRAINT "sugestoes_ia_comerciais_validado_por_user_id_fkey" FOREIGN KEY ("validado_por_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
