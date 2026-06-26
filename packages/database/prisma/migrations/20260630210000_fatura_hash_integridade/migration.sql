-- Hash SHA-256 de integridade do documento emitido (requisito software certificável AT)
ALTER TABLE "public"."faturas_comerciais"
ADD COLUMN IF NOT EXISTS "hash_integridade" CHAR(64);
