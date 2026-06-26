-- Password WFA encriptada (AES-256-GCM) para comunicação AT
ALTER TABLE "public"."config_faturacao_tenant"
ADD COLUMN IF NOT EXISTS "at_wfa_password_enc" TEXT;
