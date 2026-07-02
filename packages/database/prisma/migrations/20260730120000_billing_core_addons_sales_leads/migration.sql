-- Core + Add-ons: add-ons negociados por subscrição e leads comerciais públicos
ALTER TABLE "control_plane"."tenant_subscriptions"
  ADD COLUMN IF NOT EXISTS "custom_addons" JSONB NOT NULL DEFAULT '[]';

CREATE TABLE IF NOT EXISTS "control_plane"."platform_sales_leads" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "nome" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "empresa" TEXT,
  "telefone" TEXT,
  "plano_interesse" TEXT,
  "addons_interesse" JSONB,
  "mensagem" TEXT,
  "origem" TEXT NOT NULL DEFAULT 'welcome',
  "status" TEXT NOT NULL DEFAULT 'NOVO',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "platform_sales_leads_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "platform_sales_leads_status_created_at_idx"
  ON "control_plane"."platform_sales_leads"("status", "created_at");

CREATE INDEX IF NOT EXISTS "platform_sales_leads_email_idx"
  ON "control_plane"."platform_sales_leads"("email");
