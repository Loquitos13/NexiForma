ALTER TABLE "public"."documentos_anexo"
  ADD COLUMN IF NOT EXISTS "formando_id" UUID,
  ADD COLUMN IF NOT EXISTS "categoria" TEXT;

CREATE INDEX IF NOT EXISTS "documentos_anexo_formando_id_idx"
  ON "public"."documentos_anexo"("formando_id");

ALTER TABLE "public"."documentos_anexo"
  ADD CONSTRAINT "documentos_anexo_formando_id_fkey"
  FOREIGN KEY ("formando_id") REFERENCES "public"."formandos"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
