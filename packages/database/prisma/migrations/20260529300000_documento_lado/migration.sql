ALTER TABLE "public"."documentos_anexo"
  ADD COLUMN IF NOT EXISTS "lado" TEXT;

UPDATE "public"."documentos_anexo"
SET "categoria" = 'cc', "lado" = 'frente'
WHERE "categoria" = 'cc_frente';

UPDATE "public"."documentos_anexo"
SET "categoria" = 'cc', "lado" = 'verso'
WHERE "categoria" = 'cc_verso';

UPDATE "public"."documentos_anexo"
SET "categoria" = 'bi', "lado" = 'frente'
WHERE "categoria" IN ('identificacao', 'outro');
