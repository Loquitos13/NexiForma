-- CRM Enterprise: campos personalizados, integrações email/webhook

ALTER TABLE "public"."leads_comerciais"
  ADD COLUMN IF NOT EXISTS "metadata" JSONB;

ALTER TABLE "public"."entidades_cliente"
  ADD COLUMN IF NOT EXISTS "metadata" JSONB;

ALTER TABLE "public"."propostas_comerciais"
  ADD COLUMN IF NOT EXISTS "metadata" JSONB;

ALTER TYPE "public"."IntegracaoProvider" ADD VALUE IF NOT EXISTS 'GMAIL';
ALTER TYPE "public"."IntegracaoProvider" ADD VALUE IF NOT EXISTS 'M365';
ALTER TYPE "public"."IntegracaoProvider" ADD VALUE IF NOT EXISTS 'CRM_WEBHOOK';
