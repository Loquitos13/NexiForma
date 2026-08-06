-- AlterTable
ALTER TABLE "public"."documentos_anexo" ADD COLUMN "formador_id" UUID;

-- AddForeignKey
ALTER TABLE "public"."documentos_anexo"
  ADD CONSTRAINT "documentos_anexo_formador_id_fkey"
  FOREIGN KEY ("formador_id") REFERENCES "public"."formadores"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "documentos_anexo_formador_id_idx" ON "public"."documentos_anexo"("formador_id");
