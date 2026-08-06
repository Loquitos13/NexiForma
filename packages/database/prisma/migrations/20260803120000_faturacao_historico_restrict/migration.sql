-- Histórico de faturação imutável: impedir apagar faturas/séries por cascade.
ALTER TABLE "public"."series_faturacao"
  DROP CONSTRAINT "series_faturacao_tenant_id_fkey";
ALTER TABLE "public"."series_faturacao"
  ADD CONSTRAINT "series_faturacao_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "control_plane"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public"."faturas_comerciais"
  DROP CONSTRAINT "faturas_comerciais_tenant_id_fkey";
ALTER TABLE "public"."faturas_comerciais"
  ADD CONSTRAINT "faturas_comerciais_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "control_plane"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public"."faturas_comerciais"
  DROP CONSTRAINT "faturas_comerciais_entidade_cliente_id_fkey";
ALTER TABLE "public"."faturas_comerciais"
  ADD CONSTRAINT "faturas_comerciais_entidade_cliente_id_fkey"
  FOREIGN KEY ("entidade_cliente_id") REFERENCES "public"."entidades_cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
