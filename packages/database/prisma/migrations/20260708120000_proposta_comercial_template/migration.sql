-- Template profissional de propostas comerciais
CREATE TABLE IF NOT EXISTS "public"."config_proposta_tenant" (
  "tenant_id" UUID NOT NULL,
  "apresentacao_empresa" TEXT,
  "enquadramento_padrao" TEXT,
  "objetivos_padrao" TEXT,
  "conteudos_programaticos_padrao" TEXT,
  "metodologia_padrao" TEXT,
  "destinatarios_padrao" TEXT,
  "duracao_texto_padrao" TEXT,
  "local_texto_padrao" TEXT,
  "beneficios_padrao" TEXT,
  "condicoes_comerciais_padrao" TEXT,
  "porque_escolher_padrao" TEXT,
  "proximos_passos_padrao" TEXT,
  "validade_dias_padrao" INTEGER NOT NULL DEFAULT 30,
  "nome_contacto" TEXT,
  "email_contacto" TEXT,
  "telefone_contacto" TEXT,
  "website" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "config_proposta_tenant_pkey" PRIMARY KEY ("tenant_id")
);

ALTER TABLE "public"."propostas_comerciais"
  ADD COLUMN IF NOT EXISTS "subtitulo" TEXT,
  ADD COLUMN IF NOT EXISTS "apresentacao_empresa" TEXT,
  ADD COLUMN IF NOT EXISTS "enquadramento" TEXT,
  ADD COLUMN IF NOT EXISTS "objetivos" TEXT,
  ADD COLUMN IF NOT EXISTS "conteudos_programaticos" TEXT,
  ADD COLUMN IF NOT EXISTS "metodologia" TEXT,
  ADD COLUMN IF NOT EXISTS "destinatarios" TEXT,
  ADD COLUMN IF NOT EXISTS "duracao_texto" TEXT,
  ADD COLUMN IF NOT EXISTS "local_texto" TEXT,
  ADD COLUMN IF NOT EXISTS "beneficios" TEXT,
  ADD COLUMN IF NOT EXISTS "condicoes_comerciais" TEXT,
  ADD COLUMN IF NOT EXISTS "porque_escolher" TEXT,
  ADD COLUMN IF NOT EXISTS "proximos_passos" TEXT;
