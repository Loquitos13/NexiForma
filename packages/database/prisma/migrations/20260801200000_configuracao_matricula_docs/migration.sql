-- Configuração documental por curso e por acção (snapshot operacional)

ALTER TABLE "cursos"
  ADD COLUMN IF NOT EXISTS "configuracao_matricula" JSONB;

ALTER TABLE "acoes_formacao"
  ADD COLUMN IF NOT EXISTS "configuracao_matricula" JSONB;
