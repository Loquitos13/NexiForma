-- Parceiros: clientes com desconto comercial negociado
ALTER TABLE "public"."entidades_cliente"
  ADD COLUMN "is_parceiro" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "desconto_percent" DECIMAL(5, 2);

CREATE INDEX "entidades_cliente_tenant_id_is_parceiro_idx"
  ON "public"."entidades_cliente" ("tenant_id", "is_parceiro");
