-- Metodologia e configuração por módulo (unidade LMS)
ALTER TABLE "modulos_unidade" ADD COLUMN "metodologia" TEXT;
ALTER TABLE "modulos_unidade" ADD COLUMN "visivel" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "modulos_unidade" ADD COLUMN "obrigatorio" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "modulos_unidade" ADD COLUMN "carga_horas_teoricas" INTEGER;
ALTER TABLE "modulos_unidade" ADD COLUMN "carga_horas_praticas" INTEGER;
ALTER TABLE "modulos_unidade" ADD COLUMN "prerequisito_unidade_id" UUID;

ALTER TABLE "modulos_unidade"
  ADD CONSTRAINT "modulos_unidade_prerequisito_unidade_id_fkey"
  FOREIGN KEY ("prerequisito_unidade_id") REFERENCES "modulos_unidade"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Progressão LMS do curso (livre vs sequencial)
ALTER TABLE "cursos" ADD COLUMN "lms_progressao_sequencial" BOOLEAN NOT NULL DEFAULT true;

-- Tipos de pergunta em quizzes
ALTER TABLE "quiz_perguntas" ADD COLUMN "tipo" TEXT NOT NULL DEFAULT 'MULTIPLA';
ALTER TABLE "quiz_perguntas" ADD COLUMN "explicacao" TEXT;
