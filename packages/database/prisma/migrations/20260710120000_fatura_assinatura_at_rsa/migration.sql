-- Assinatura RSA-SHA1 AT (Base64 ~172 chars) + versão da chave privada (HashControl)
ALTER TABLE "public"."faturas_comerciais"
  ALTER COLUMN "hash_integridade" TYPE VARCHAR(256) USING "hash_integridade"::VARCHAR(256);

ALTER TABLE "public"."faturas_comerciais"
  ADD COLUMN IF NOT EXISTS "hash_control" VARCHAR(32);
