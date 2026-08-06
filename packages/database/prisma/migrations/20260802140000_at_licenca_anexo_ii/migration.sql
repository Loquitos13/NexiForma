-- Aceite Licença Anexo II (Contrato de adesão webservice AT) por tenant emitente

ALTER TABLE "public"."config_faturacao_tenant"
  ADD COLUMN IF NOT EXISTS "at_licenca_aceite_em" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "at_licenca_aceite_por_user_id" UUID,
  ADD COLUMN IF NOT EXISTS "at_licenca_versao" VARCHAR(64);
