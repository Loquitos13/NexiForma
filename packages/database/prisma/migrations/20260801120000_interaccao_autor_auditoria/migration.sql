-- Auditoria imutável do autor em interacções CRM (mantém-se após eliminar utilizador).

ALTER TABLE "public"."interaccoes_comerciais"
  ADD COLUMN "criado_por_autor_id" UUID,
  ADD COLUMN "criado_por_display_name" TEXT,
  ADD COLUMN "criado_por_email" TEXT;

UPDATE "public"."interaccoes_comerciais" AS i
SET
  "criado_por_autor_id" = i."criado_por_user_id",
  "criado_por_display_name" = u."display_name",
  "criado_por_email" = u."email"
FROM "public"."users" AS u
WHERE u."id" = i."criado_por_user_id";

UPDATE "public"."interaccoes_comerciais"
SET
  "criado_por_autor_id" = "criado_por_user_id",
  "criado_por_display_name" = COALESCE("criado_por_display_name", 'Utilizador removido'),
  "criado_por_email" = COALESCE("criado_por_email", '')
WHERE "criado_por_autor_id" IS NULL;

ALTER TABLE "public"."interaccoes_comerciais"
  ALTER COLUMN "criado_por_autor_id" SET NOT NULL,
  ALTER COLUMN "criado_por_display_name" SET NOT NULL,
  ALTER COLUMN "criado_por_email" SET NOT NULL;

ALTER TABLE "public"."interaccoes_comerciais" DROP CONSTRAINT "interaccoes_comerciais_criado_por_user_id_fkey";

ALTER TABLE "public"."interaccoes_comerciais"
  ALTER COLUMN "criado_por_user_id" DROP NOT NULL;

ALTER TABLE "public"."interaccoes_comerciais"
  ADD CONSTRAINT "interaccoes_comerciais_criado_por_user_id_fkey"
  FOREIGN KEY ("criado_por_user_id") REFERENCES "public"."users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "interaccoes_comerciais_criado_por_autor_id_idx"
  ON "public"."interaccoes_comerciais"("criado_por_autor_id");
