-- Fase 10: CRM entidades, propostas comerciais, validade CC/CCP formadores

ALTER TABLE "public"."formadores"
  ADD COLUMN IF NOT EXISTS "cc_validade" DATE,
  ADD COLUMN IF NOT EXISTS "ccp_validade" DATE;

CREATE TYPE "PropostaEstado" AS ENUM ('RASCUNHO', 'ENVIADA', 'ACEITE', 'REJEITADA', 'CANCELADA');

CREATE TABLE IF NOT EXISTS "public"."propostas_comerciais" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "entidade_cliente_id" UUID NOT NULL,
  "codigo" TEXT NOT NULL,
  "titulo" TEXT NOT NULL,
  "descricao" TEXT,
  "valor_centavos" INTEGER NOT NULL DEFAULT 0,
  "moeda" CHAR(3) NOT NULL DEFAULT 'EUR',
  "estado" "PropostaEstado" NOT NULL DEFAULT 'RASCUNHO',
  "validade_ate" DATE,
  "curso_id" UUID,
  "notas_internas" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "propostas_comerciais_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "propostas_comerciais_tenant_id_codigo_key"
  ON "public"."propostas_comerciais"("tenant_id", "codigo");
CREATE INDEX IF NOT EXISTS "propostas_comerciais_tenant_id_idx"
  ON "public"."propostas_comerciais"("tenant_id");
CREATE INDEX IF NOT EXISTS "propostas_comerciais_entidade_cliente_id_idx"
  ON "public"."propostas_comerciais"("entidade_cliente_id");

ALTER TABLE "public"."propostas_comerciais"
  ADD CONSTRAINT "propostas_comerciais_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "control_plane"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."propostas_comerciais"
  ADD CONSTRAINT "propostas_comerciais_entidade_cliente_id_fkey"
  FOREIGN KEY ("entidade_cliente_id") REFERENCES "public"."entidades_cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."propostas_comerciais"
  ADD CONSTRAINT "propostas_comerciais_curso_id_fkey"
  FOREIGN KEY ("curso_id") REFERENCES "public"."cursos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
