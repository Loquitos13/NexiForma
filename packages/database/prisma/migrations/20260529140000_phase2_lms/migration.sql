-- Fase 2: LMS / assiduidade online por sessão
ALTER TABLE "sessoes_formacao" ADD COLUMN "lms_ativo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "sessoes_formacao" ADD COLUMN "zoom_meeting_id" TEXT;
ALTER TABLE "sessoes_formacao" ADD COLUMN "minutos_presenca_min" INTEGER NOT NULL DEFAULT 60;
