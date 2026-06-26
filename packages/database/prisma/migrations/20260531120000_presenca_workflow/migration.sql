-- Workflow de presenças: estados por formando + validação formador / aprovação gestor

ALTER TABLE "folhas_presenca" ADD COLUMN "turma_id" UUID;
ALTER TABLE "folhas_presenca" ADD COLUMN "validada_formador_em" TIMESTAMPTZ;
ALTER TABLE "folhas_presenca" ADD COLUMN "validada_formador_por" UUID;
ALTER TABLE "folhas_presenca" ADD COLUMN "aprovada_gestor_em" TIMESTAMPTZ;
ALTER TABLE "folhas_presenca" ADD COLUMN "aprovada_gestor_por" UUID;

ALTER TABLE "presencas" ADD COLUMN "estado" TEXT NOT NULL DEFAULT 'PENDENTE';
ALTER TABLE "presencas" ADD COLUMN "motivo_justificacao" TEXT;

UPDATE "presencas" SET "estado" = 'PRESENTE' WHERE "presente" = true;
UPDATE "presencas" SET "estado" = 'FALTA_INJUSTIFICADA' WHERE "presente" = false AND "validado" = true;

ALTER TABLE "folhas_presenca" ADD CONSTRAINT "folhas_presenca_turma_id_fkey"
  FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "folhas_presenca_sessao_id_turma_id_key"
  ON "folhas_presenca"("sessao_id", "turma_id")
  WHERE "turma_id" IS NOT NULL;
