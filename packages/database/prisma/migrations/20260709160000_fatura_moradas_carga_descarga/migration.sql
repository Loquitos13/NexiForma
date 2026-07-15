-- Moradas de transporte (carga/descarga) em faturas comerciais
ALTER TABLE "public"."faturas_comerciais"
  ADD COLUMN "morada_carga" TEXT,
  ADD COLUMN "morada_descarga" TEXT;
