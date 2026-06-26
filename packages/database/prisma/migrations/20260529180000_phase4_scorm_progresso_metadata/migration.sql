-- Fase 4: estado SCORM/CMI em progresso por matrícula
ALTER TABLE "public"."progressos_modulo" ADD COLUMN "metadata" JSONB;
