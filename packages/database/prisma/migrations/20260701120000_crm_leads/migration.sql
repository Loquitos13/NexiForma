-- CRM Leads comerciais (pipeline pré-entidade)

CREATE TYPE "LeadEstado" AS ENUM ('NOVO', 'CONTACTADO', 'QUALIFICADO', 'CONVERTIDO', 'PERDIDO');
CREATE TYPE "LeadOrigem" AS ENUM ('WEBSITE', 'REFERRAL', 'FEIRA', 'LINKEDIN', 'TELEFONE', 'OUTRO');

CREATE TABLE IF NOT EXISTS "public"."leads_comerciais" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "codigo" TEXT NOT NULL,
  "empresa_nome" TEXT NOT NULL,
  "contacto_nome" TEXT,
  "email" TEXT,
  "telefone" TEXT,
  "nif" TEXT,
  "origem" "LeadOrigem" NOT NULL DEFAULT 'OUTRO',
  "estado" "LeadEstado" NOT NULL DEFAULT 'NOVO',
  "valor_estimado_centavos" INTEGER NOT NULL DEFAULT 0,
  "notas" TEXT,
  "motivo_perda" TEXT,
  "entidade_cliente_id" UUID,
  "atribuido_user_id" UUID,
  "convertido_em" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "leads_comerciais_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "leads_comerciais_tenant_id_codigo_key"
  ON "public"."leads_comerciais"("tenant_id", "codigo");
CREATE INDEX IF NOT EXISTS "leads_comerciais_tenant_id_idx"
  ON "public"."leads_comerciais"("tenant_id");
CREATE INDEX IF NOT EXISTS "leads_comerciais_tenant_id_estado_idx"
  ON "public"."leads_comerciais"("tenant_id", "estado");
CREATE INDEX IF NOT EXISTS "leads_comerciais_entidade_cliente_id_idx"
  ON "public"."leads_comerciais"("entidade_cliente_id");

ALTER TABLE "public"."leads_comerciais"
  ADD CONSTRAINT "leads_comerciais_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "control_plane"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."leads_comerciais"
  ADD CONSTRAINT "leads_comerciais_entidade_cliente_id_fkey"
  FOREIGN KEY ("entidade_cliente_id") REFERENCES "public"."entidades_cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."leads_comerciais"
  ADD CONSTRAINT "leads_comerciais_atribuido_user_id_fkey"
  FOREIGN KEY ("atribuido_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
