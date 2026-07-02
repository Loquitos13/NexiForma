-- Dados legais obrigatórios: cliente (destinatário) e emitente (faturação)

ALTER TABLE "public"."entidades_cliente"
  ADD COLUMN IF NOT EXISTS "morada_fiscal" TEXT;

ALTER TABLE "public"."config_faturacao_tenant"
  ADD COLUMN IF NOT EXISTS "iban" VARCHAR(34),
  ADD COLUMN IF NOT EXISTS "bic_swift" VARCHAR(11),
  ADD COLUMN IF NOT EXISTS "email_gestor" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "capital_social" VARCHAR(64),
  ADD COLUMN IF NOT EXISTS "cons_reg_com" VARCHAR(128);
