-- PDF assinado do sumário (substitui Chave Móvel Digital)
ALTER TABLE "public"."sumarios"
  ADD COLUMN IF NOT EXISTS "pdf_storage_key" TEXT,
  ADD COLUMN IF NOT EXISTS "pdf_nome_ficheiro" TEXT,
  ADD COLUMN IF NOT EXISTS "pdf_sha256" VARCHAR(64);
