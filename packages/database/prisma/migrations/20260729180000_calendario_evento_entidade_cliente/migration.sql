-- Lembretes/eventos de calendário podem associar-se a um cliente B2B.
ALTER TABLE "public"."calendario_eventos"
  ADD COLUMN "entidade_cliente_id" UUID;

CREATE INDEX "calendario_eventos_entidade_cliente_id_idx"
  ON "public"."calendario_eventos"("entidade_cliente_id");

ALTER TABLE "public"."calendario_eventos"
  ADD CONSTRAINT "calendario_eventos_entidade_cliente_id_fkey"
  FOREIGN KEY ("entidade_cliente_id") REFERENCES "public"."entidades_cliente"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
