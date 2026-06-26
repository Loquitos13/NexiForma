-- Fase 10B.4: dados legais emitente + destinatário na fatura

ALTER TABLE "public"."config_faturacao_tenant"
  ADD COLUMN "nome_empresa" TEXT,
  ADD COLUMN "morada_fiscal" TEXT;

UPDATE "public"."config_faturacao_tenant" c
SET "nome_empresa" = t."legal_name"
FROM "control_plane"."tenants" t
WHERE c."tenant_id" = t."id";

ALTER TABLE "public"."config_faturacao_tenant"
  ALTER COLUMN "nome_empresa" SET NOT NULL;

ALTER TABLE "public"."faturas_comerciais"
  ADD COLUMN "destinatario_nome" TEXT,
  ADD COLUMN "destinatario_nif" TEXT,
  ADD COLUMN "destinatario_morada" TEXT;

UPDATE "public"."faturas_comerciais" f
SET
  "destinatario_nome" = e."nome",
  "destinatario_nif" = e."nif"
FROM "public"."entidades_cliente" e
WHERE f."entidade_cliente_id" = e."id";

ALTER TABLE "public"."faturas_comerciais"
  ALTER COLUMN "destinatario_nome" SET NOT NULL,
  ALTER COLUMN "destinatario_nif" SET NOT NULL;
