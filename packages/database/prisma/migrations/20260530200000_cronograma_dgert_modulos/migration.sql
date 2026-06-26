-- Cronograma DGERT: módulos com código/horas/formador e ligação sessão-módulo
ALTER TABLE "public"."modulos_unidade"
  ADD COLUMN IF NOT EXISTS "codigo" TEXT,
  ADD COLUMN IF NOT EXISTS "carga_horas" INTEGER,
  ADD COLUMN IF NOT EXISTS "formador_id" UUID;

ALTER TABLE "public"."sessoes_formacao"
  ADD COLUMN IF NOT EXISTS "modulo_unidade_id" UUID;

DO $$ BEGIN
  ALTER TABLE "public"."modulos_unidade"
    ADD CONSTRAINT "modulos_unidade_formador_id_fkey"
    FOREIGN KEY ("formador_id") REFERENCES "public"."formadores"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "public"."sessoes_formacao"
    ADD CONSTRAINT "sessoes_formacao_modulo_unidade_id_fkey"
    FOREIGN KEY ("modulo_unidade_id") REFERENCES "public"."modulos_unidade"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
