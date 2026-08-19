-- CreateEnum
CREATE TYPE "public"."ContratoComercialEstado" AS ENUM ('RASCUNHO', 'VIGENTE', 'CANCELADO');

-- CreateTable
CREATE TABLE "public"."contratos_comerciais" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "entidade_cliente_id" UUID NOT NULL,
    "proposta_id" UUID,
    "codigo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "template_id" TEXT,
    "body_html" TEXT,
    "data_inicio" DATE,
    "data_fim" DATE,
    "valor_centavos" INTEGER NOT NULL DEFAULT 0,
    "estado" "public"."ContratoComercialEstado" NOT NULL DEFAULT 'RASCUNHO',
    "notas_internas" TEXT,
    "criado_por_user_id" UUID,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contratos_comerciais_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contratos_comerciais_tenant_id_idx" ON "public"."contratos_comerciais"("tenant_id");

-- CreateIndex
CREATE INDEX "contratos_comerciais_entidade_cliente_id_idx" ON "public"."contratos_comerciais"("entidade_cliente_id");

-- CreateIndex
CREATE INDEX "contratos_comerciais_proposta_id_idx" ON "public"."contratos_comerciais"("proposta_id");

-- CreateIndex
CREATE INDEX "contratos_comerciais_criado_por_user_id_idx" ON "public"."contratos_comerciais"("criado_por_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "contratos_comerciais_tenant_id_codigo_key" ON "public"."contratos_comerciais"("tenant_id", "codigo");

-- AddForeignKey
ALTER TABLE "public"."contratos_comerciais" ADD CONSTRAINT "contratos_comerciais_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "control_plane"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."contratos_comerciais" ADD CONSTRAINT "contratos_comerciais_entidade_cliente_id_fkey" FOREIGN KEY ("entidade_cliente_id") REFERENCES "public"."entidades_cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."contratos_comerciais" ADD CONSTRAINT "contratos_comerciais_proposta_id_fkey" FOREIGN KEY ("proposta_id") REFERENCES "public"."propostas_comerciais"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."contratos_comerciais" ADD CONSTRAINT "contratos_comerciais_criado_por_user_id_fkey" FOREIGN KEY ("criado_por_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
