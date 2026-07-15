-- Atribuição CRM: quem criou lead/proposta (partilha entre equipa comercial)

ALTER TABLE "public"."leads_comerciais"
  ADD COLUMN "criado_por_user_id" UUID;

ALTER TABLE "public"."propostas_comerciais"
  ADD COLUMN "criado_por_user_id" UUID;

UPDATE "public"."leads_comerciais"
SET "criado_por_user_id" = "atribuido_user_id"
WHERE "criado_por_user_id" IS NULL AND "atribuido_user_id" IS NOT NULL;

UPDATE "public"."propostas_comerciais"
SET "criado_por_user_id" = "enviada_por_user_id"
WHERE "criado_por_user_id" IS NULL AND "enviada_por_user_id" IS NOT NULL;

ALTER TABLE "public"."leads_comerciais"
  ADD CONSTRAINT "leads_comerciais_criado_por_user_id_fkey"
  FOREIGN KEY ("criado_por_user_id") REFERENCES "public"."users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."propostas_comerciais"
  ADD CONSTRAINT "propostas_comerciais_criado_por_user_id_fkey"
  FOREIGN KEY ("criado_por_user_id") REFERENCES "public"."users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "leads_comerciais_criado_por_user_id_idx"
  ON "public"."leads_comerciais"("criado_por_user_id");

CREATE INDEX "propostas_comerciais_criado_por_user_id_idx"
  ON "public"."propostas_comerciais"("criado_por_user_id");
