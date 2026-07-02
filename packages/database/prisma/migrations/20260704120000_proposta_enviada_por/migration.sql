-- Quem enviou a proposta (notificações comercial em aceite/rejeição)
ALTER TABLE "public"."propostas_comerciais"
  ADD COLUMN IF NOT EXISTS "enviada_por_user_id" UUID;

ALTER TABLE "public"."propostas_comerciais"
  ADD CONSTRAINT "propostas_comerciais_enviada_por_user_id_fkey"
  FOREIGN KEY ("enviada_por_user_id") REFERENCES "public"."users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "propostas_comerciais_enviada_por_user_id_idx"
  ON "public"."propostas_comerciais"("enviada_por_user_id");
